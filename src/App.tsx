import React, { useState, useEffect, useRef } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  DragStartEvent, 
  DragEndEvent 
} from '@dnd-kit/core';
import { Plus, X, GripVertical, ChevronDown, AlertCircle, User as UserIcon, Trash2, ChevronRight, ChevronLeft, ArrowLeft, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import { 
  User, Year, ClassWithBatches, Professor, Subject, Classroom, 
  TimetableEntry, DAYS, TIME_SLOTS 
} from './types';

const INITIAL_YEAR_NAME = 'Spring 2026';
const LUNCH_COLOR = '#e6d9c8';
const LUNCH_SLOT_12_1 = 3; // index in TIME_SLOTS
const LUNCH_SLOT_1_2 = 4;

const COLOR_PALETTE = [
  '#0EA5E9', // sky
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F97316', // orange
  '#F59E0B', // amber
  '#22C55E', // green
  '#14B8A6', // teal
  '#10B981', // emerald
  '#EF4444', // red
  '#A3A3A3', // neutral
] as const;

function hexToRgba(hex: string, alpha: number) {
  let cleaned = hex.trim().replace('#', '');
  if (cleaned.length === 3) cleaned = cleaned.split('').map(c => c + c).join('');
  if (cleaned.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

let yearIdCounter = 1;
let classIdCounter = 1;
let batchIdCounter = 1;
let professorIdCounter = 1;
let subjectIdCounter = 1;
let classroomIdCounter = 1;
let timetableEntryIdCounter = 1;

function createInitialData(): { years: Year[]; classes: ClassWithBatches[] } {
  const years: Year[] = [];
  const classes: ClassWithBatches[] = [];

  const year: Year = { id: yearIdCounter++, name: INITIAL_YEAR_NAME };
  years.push(year);

  for (let i = 1; i <= 8; i++) {
    const classId = classIdCounter++;
    const prefix = String.fromCharCode(64 + i);
    const batches = [];
    for (let b = 1; b <= 3; b++) {
      batches.push({
        id: batchIdCounter++,
        class_id: classId,
        name: `${prefix}${b}`,
      });
    }
    classes.push({
      id: classId,
      year_id: year.id,
      name: `Class ${i}`,
      batches,
    });
  }

  return { years, classes };
}

const INITIAL_DATA = createInitialData();

// --- Components ---

const DraggableChip = ({ id, type, data, onRemove, onUpdate, professors }: { id: string, type: string, data: any, onRemove?: () => void, onUpdate?: (newData: any) => void, professors?: Professor[] }) => {
  const professor = professors?.find(p => p.id === data.professor_id);
  const professorColor = professor?.color;
  
  return (
    <div 
      className="chip group"
      style={{ touchAction: 'none' }}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <GripVertical className="w-4 h-4 text-muted-steel opacity-40 shrink-0" />
        {professorColor && (
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 border border-border-blue-gray"
            style={{ backgroundColor: professorColor }}
            aria-hidden="true"
          />
        )}
        <div className="flex flex-col truncate leading-tight">
          <span className="truncate font-medium">{data.name}</span>
          {professor && <span className="text-[10px] text-muted-steel truncate">{professor.name}</span>}
        </div>
      </div>
      {onRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }} 
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-deep-navy rounded transition-all shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

const DroppableCell = ({ 
  day, 
  slotIdx, 
  classId, 
  batchId, 
  entry, 
  onClear,
  onOpenAttendance,
  readOnly,
  professors,
  subjects,
  classrooms
}: { 
  day: number, 
  slotIdx: number, 
  classId: number, 
  batchId: number, 
  entry?: TimetableEntry,
  onClear: () => void,
  onOpenAttendance?: () => void,
  readOnly?: boolean,
  professors: Professor[],
  subjects: Subject[],
  classrooms: Classroom[]
}) => {
  const subject = subjects.find(s => s.id === entry?.subject_id);
  const professor = professors.find(p => p.id === entry?.professor_id);
  const classroom = classrooms.find(c => c.id === entry?.classroom_id);
  const professorColor = professor?.color;
  const hasEntry = !!entry;
  const draggableId = `cellEntry:${day}:${slotIdx}:${classId}:${batchId}`;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: draggableId });

  const cardStyle = hasEntry
    ? {
        backgroundColor: professorColor || '#020617',
        ...(professorColor
          ? { borderLeft: `3px solid ${professorColor}` }
          : {}),
      }
    : undefined;

  return (
    <div className="h-20 border-b border-border-blue-gray last:border-b-0 px-1 py-1">
      <AnimatePresence mode="popLayout">
        {hasEntry && (
          <motion.div 
            key={`${entry.day}-${entry.time_slot}-${entry.class_id}-${entry.batch_id}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            ref={setNodeRef}
            {...(!readOnly ? attributes : {})}
            {...(!readOnly ? listeners : {})}
            className={cn(
              "relative flex items-center gap-2 w-full h-full rounded-md px-3 overflow-hidden group shadow-sm",
              readOnly ? "cursor-pointer" : "cursor-move",
              isDragging && "opacity-40"
            )}
            style={cardStyle}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onOpenAttendance?.();
            }}
          >
            <div className="flex flex-col leading-snug flex-1 truncate text-black">
              <span className="font-bold italic text-sm truncate">
                {subject?.name || '---'}
              </span>
              <span className="text-xs truncate font-medium">
                {professor?.name || '---'}
              </span>
              <span className="text-xs truncate">
                {classroom?.name || '---'}
              </span>
            </div>
            {!readOnly && <button 
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-blue rounded absolute right-1 top-1 bg-midnight-blue border border-border-blue-gray shadow-none z-10"
            >
              <X className="w-3 h-3" />
            </button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user] = useState<User | null>({ id: 'admin', name: 'Administrator' });
  const [years, setYears] = useState<Year[]>(INITIAL_DATA.years);
  const [allClasses, setAllClasses] = useState<ClassWithBatches[]>(INITIAL_DATA.classes);
  const [selectedYear, setSelectedYear] = useState<Year | null>(INITIAL_DATA.years[0] ?? null);
  const [classes, setClasses] = useState<ClassWithBatches[]>(() =>
    INITIAL_DATA.years[0]
      ? INITIAL_DATA.classes.filter(c => c.year_id === INITIAL_DATA.years[0]!.id)
      : []
  );
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [activeDrag, setActiveDrag] = useState<{ id: string, type: string, data: any } | null>(null);
  const [conflict, setConflict] = useState<{ message: string, data: any } | null>(null);
  const [isProfessorModalOpen, setIsProfessorModalOpen] = useState(false);
  const [pendingProfessorName, setPendingProfessorName] = useState<string | null>(null);
  const [pendingProfessorColor, setPendingProfessorColor] = useState<string>(COLOR_PALETTE[0]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [hasLoadedSavedStacks, setHasLoadedSavedStacks] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [rollNumbersByClass, setRollNumbersByClass] = useState<Record<number, string[]>>({});
  const [rollNumbersByBatch, setRollNumbersByBatch] = useState<Record<number, string[]>>({});
  const [rollRangeByClass, setRollRangeByClass] = useState<Record<number, string>>({});
  const [rollRangeByBatch, setRollRangeByBatch] = useState<Record<number, string>>({});
  const [attendanceTarget, setAttendanceTarget] = useState<TimetableEntry | null>(null);
  const [attendanceMarks, setAttendanceMarks] = useState<Record<string, boolean>>({}); // true means absent
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, Record<string, boolean>>>({});
  const [monthlyAttendanceSnapshots, setMonthlyAttendanceSnapshots] = useState<Record<string, {
    updatedAt: string;
    classes: Array<{
      classId: number;
      className: string;
      totalLectures: number;
      lowAttendanceRolls: Array<{ roll: string; pct: number; present: number; total: number }>;
    }>;
  }>>({});
  const [autoCreateErrors, setAutoCreateErrors] = useState<string[]>([]);
  const [mondayDate, setMondayDate] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  });

  const [loginStep, setLoginStep] = useState<'choose' | 'incharge_password' | 'professor_password' | 'under_construction'>('choose');
  const [userRole, setUserRole] = useState<'incharge' | 'professor' | null>(null);
  const [inchargePassword, setInchargePassword] = useState('');
  const [inchargeError, setInchargeError] = useState('');
  const [professorPassword, setProfessorPassword] = useState('');
  const [professorError, setProfessorError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('timecards.theme') === 'light' ? 'light' : 'dark';
  });

  const getDateForDay = (dayIdx: number) => {
    const date = new Date(mondayDate);
    date.setDate(date.getDate() + dayIdx);
    return date.toLocaleDateString('en-GB'); // dd/mm/yyyy
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const LOCAL_STACKS_KEY = 'timecards.stacks.local.v1';
  const LOCAL_ATTENDANCE_KEY = 'timecards.attendance.local.v1';

  const reseedCountersFromStacks = (next: { professors: Professor[]; subjects: Subject[]; classrooms: Classroom[] }) => {
    const maxProfessorId = next.professors.reduce((m, p) => Math.max(m, p.id), 0);
    const maxSubjectId = next.subjects.reduce((m, s) => Math.max(m, s.id), 0);
    const maxClassroomId = next.classrooms.reduce((m, c) => Math.max(m, c.id), 0);
    professorIdCounter = Math.max(professorIdCounter, maxProfessorId + 1);
    subjectIdCounter = Math.max(subjectIdCounter, maxSubjectId + 1);
    classroomIdCounter = Math.max(classroomIdCounter, maxClassroomId + 1);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('timecards.theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LOCAL_STACKS_KEY);
      if (!raw) {
        setHasLoadedSavedStacks(true);
        return;
      }
      const parsed = JSON.parse(raw) as any;
      const next = {
        professors: Array.isArray(parsed?.professors) ? parsed.professors : [],
        subjects: Array.isArray(parsed?.subjects) ? parsed.subjects : [],
        classrooms: Array.isArray(parsed?.classrooms) ? parsed.classrooms : [],
        rollNumbersByClass: parsed?.rollNumbersByClass && typeof parsed.rollNumbersByClass === 'object' ? parsed.rollNumbersByClass : {},
        rollNumbersByBatch: parsed?.rollNumbersByBatch && typeof parsed.rollNumbersByBatch === 'object' ? parsed.rollNumbersByBatch : {},
        rollRangeByClass: parsed?.rollRangeByClass && typeof parsed.rollRangeByClass === 'object' ? parsed.rollRangeByClass : {},
        rollRangeByBatch: parsed?.rollRangeByBatch && typeof parsed.rollRangeByBatch === 'object' ? parsed.rollRangeByBatch : {},
      };

      setProfessors(next.professors);
      setSubjects(next.subjects);
      setClassrooms(next.classrooms);
      setRollNumbersByClass(next.rollNumbersByClass);
      setRollNumbersByBatch(next.rollNumbersByBatch);
      setRollRangeByClass(next.rollRangeByClass);
      setRollRangeByBatch(next.rollRangeByBatch);
      reseedCountersFromStacks({
        professors: next.professors,
        subjects: next.subjects,
        classrooms: next.classrooms,
      });
    } catch {
      // Ignore corrupted local storage
    } finally {
      setHasLoadedSavedStacks(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasLoadedSavedStacks) return;
    try {
      window.localStorage.setItem(LOCAL_STACKS_KEY, JSON.stringify({
        version: 1,
        professors,
        subjects,
        classrooms,
        rollNumbersByClass,
        rollNumbersByBatch,
        rollRangeByClass,
        rollRangeByBatch,
      }));
    } catch {
      // Ignore quota / storage errors
    }
  }, [professors, subjects, classrooms, rollNumbersByClass, rollNumbersByBatch, rollRangeByClass, rollRangeByBatch, hasLoadedSavedStacks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LOCAL_ATTENDANCE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as any;
      setAttendanceRecords(parsed?.attendanceRecords && typeof parsed.attendanceRecords === 'object' ? parsed.attendanceRecords : {});
      setMonthlyAttendanceSnapshots(
        parsed?.monthlyAttendanceSnapshots && typeof parsed.monthlyAttendanceSnapshots === 'object'
          ? parsed.monthlyAttendanceSnapshots
          : {}
      );
    } catch {
      // Ignore corrupted local storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify({
        attendanceRecords,
        monthlyAttendanceSnapshots,
      }));
    } catch {
      // Ignore quota / storage errors
    }
  }, [attendanceRecords, monthlyAttendanceSnapshots]);

  useEffect(() => {
    if (selectedYear) {
      setClasses(allClasses.filter(c => c.year_id === selectedYear.id));
    }
  }, [selectedYear, allClasses]);

  type ExportFileV1 = {
    format: 'timecards-stacks';
    version: 1;
    professors: Array<{ name: string; color?: string }>;
    subjects: Array<{ name: string; weightage?: number; professor?: string; allowedClasses?: string[]; allowedBatches?: string[]; mode?: 'lecture' | 'lab' }>;
    classrooms: Array<{ name: string; roomType?: 'lecture' | 'lab'; allowedSubjects?: string[] }>;
    rollNumbers?: {
      classes: Array<{ className: string; rollNumbers: string[] }>;
      batches: Array<{ batchName: string; rollNumbers: string[] }>;
    };
  };

  const normalizeColor = (c: unknown) => {
    if (typeof c !== 'string') return undefined;
    const s = c.trim();
    if (/^#([0-9a-fA-F]{3}){1,2}$/.test(s)) return s.toUpperCase();
    return undefined;
  };

  const exportStacksToFile = () => {
    const classNameById = new Map<number, string>(allClasses.map(c => [c.id, c.name]));
    const batchNameById = new Map<number, string>();
    for (const c of allClasses) for (const b of c.batches) batchNameById.set(b.id, b.name);
    const professorNameById = new Map<number, string>(professors.map(p => [p.id, p.name]));
    const subjectNameById = new Map<number, string>(subjects.map(s => [s.id, s.name]));

    const file: ExportFileV1 = {
      format: 'timecards-stacks',
      version: 1,
      professors: professors.map(p => ({ name: p.name, color: p.color })),
      subjects: subjects.map(s => ({
        name: s.name,
        weightage: s.weightage,
        professor: s.professor_id ? professorNameById.get(s.professor_id) : undefined,
        allowedClasses: (s.allowed_class_ids ?? [])
          .map(id => classNameById.get(id))
          .filter((x): x is string => typeof x === 'string'),
        allowedBatches: (s.allowed_batch_ids ?? []).map(id => batchNameById.get(id)).filter((x): x is string => typeof x === 'string'),
        mode: s.mode,
      })),
      classrooms: classrooms.map(c => ({
        name: c.name,
        roomType: c.room_type,
        allowedSubjects: (c.allowed_subject_ids ?? []).map(id => subjectNameById.get(id)).filter((x): x is string => typeof x === 'string'),
      })),
      rollNumbers: {
        classes: Object.entries(rollNumbersByClass)
          .map(([classId, rollNumbers]) => ({
            className: classNameById.get(Number(classId)) ?? '',
            rollNumbers,
          }))
          .filter((x) => !!x.className),
        batches: Object.entries(rollNumbersByBatch)
          .map(([batchId, rollNumbers]) => ({
            batchName: batchNameById.get(Number(batchId)) ?? '',
            rollNumbers,
          }))
          .filter((x) => !!x.batchName),
      },
    };

    const text = JSON.stringify(file, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timecards-stacks.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importStacksFromText = (text: string) => {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      alert('Import failed: file is not valid JSON.');
      return;
    }

    if (parsed?.format !== 'timecards-stacks' || parsed?.version !== 1) {
      alert('Import failed: unrecognized file format.');
      return;
    }

    const currentYearClasses = classes.length > 0 ? classes : allClasses.filter(c => c.year_id === (selectedYear?.id ?? -1));
    const classIdByName = new Map<string, number>(currentYearClasses.map(c => [c.name, c.id]));
    const batchIdByName = new Map<string, number>();
    for (const c of currentYearClasses) for (const b of c.batches) batchIdByName.set(b.name, b.id);

    const nextProfessors: Professor[] = [];
    const profIdByName = new Map<string, number>();

    const rawProfs = Array.isArray(parsed?.professors) ? parsed.professors : [];
    for (const p of rawProfs) {
      const name = typeof p?.name === 'string' ? p.name.trim() : '';
      if (!name) continue;
      const color = normalizeColor(p?.color) ?? COLOR_PALETTE[nextProfessors.length % COLOR_PALETTE.length];

      const existingId = profIdByName.get(name);
      if (existingId) {
        const idx = nextProfessors.findIndex(x => x.id === existingId);
        if (idx !== -1) nextProfessors[idx] = { ...nextProfessors[idx], color };
        continue;
      }

      const id = professorIdCounter++;
      nextProfessors.push({ id, name, color });
      profIdByName.set(name, id);
    }

    const rawSubjects = Array.isArray(parsed?.subjects) ? parsed.subjects : [];
    const nextSubjects: Subject[] = [];
    for (const s of rawSubjects) {
      const name = typeof s?.name === 'string' ? s.name.trim() : '';
      if (!name) continue;

      const weightageRaw = s?.weightage;
      const weightage = typeof weightageRaw === 'number' && Number.isFinite(weightageRaw) ? Math.max(1, Math.round(weightageRaw)) : 1;

      const professorName = typeof s?.professor === 'string' ? s.professor.trim() : '';
      const professor_id = professorName ? profIdByName.get(professorName) : undefined;

      const allowedNames = Array.isArray(s?.allowedClasses) ? s.allowedClasses : [];
      const allowed_class_ids = allowedNames
        .map((n: any) => (typeof n === 'string' ? classIdByName.get(n.trim()) : undefined))
        .filter((x): x is number => typeof x === 'number');
      const allowedBatchNames = Array.isArray(s?.allowedBatches) ? s.allowedBatches : [];
      const allowed_batch_ids = allowedBatchNames
        .map((n: any) => (typeof n === 'string' ? batchIdByName.get(n.trim()) : undefined))
        .filter((x): x is number => typeof x === 'number');
      const mode = s?.mode === 'lab' || s?.mode === 'lecture' ? s.mode : undefined;

      nextSubjects.push({
        id: subjectIdCounter++,
        name,
        weightage,
        professor_id,
        allowed_class_ids: Array.from(new Set(allowed_class_ids)),
        allowed_batch_ids: Array.from(new Set(allowed_batch_ids)),
        mode,
      });
    }
    const subjectIdByName = new Map<string, number>(nextSubjects.map(s => [s.name, s.id]));

    const rawClassrooms = Array.isArray(parsed?.classrooms) ? parsed.classrooms : [];
    const nextClassrooms: Classroom[] = [];
    for (const c of rawClassrooms) {
      const name = typeof c?.name === 'string' ? c.name.trim() : '';
      if (!name) continue;
      const roomType = c?.roomType === 'lab' || c?.roomType === 'lecture' ? c.roomType : undefined;
      const allowedSubjectNames = Array.isArray(c?.allowedSubjects) ? c.allowedSubjects : [];
      const allowed_subject_ids = allowedSubjectNames
        .map((n: any) => (typeof n === 'string' ? subjectIdByName.get(n.trim()) : undefined))
        .filter((x): x is number => typeof x === 'number');
      nextClassrooms.push({
        id: classroomIdCounter++,
        name,
        room_type: roomType,
        allowed_subject_ids: allowed_subject_ids.length ? allowed_subject_ids : undefined,
      });
    }

    const nextRollNumbersByClass: Record<number, string[]> = {};
    const importedClassRolls = Array.isArray(parsed?.rollNumbers?.classes) ? parsed.rollNumbers.classes : [];
    for (const item of importedClassRolls) {
      const className = typeof item?.className === 'string' ? item.className.trim() : '';
      const classId = className ? classIdByName.get(className) : undefined;
      if (!classId) continue;
      const rolls = Array.isArray(item?.rollNumbers) ? item.rollNumbers : [];
      nextRollNumbersByClass[classId] = Array.from(new Set(
        rolls.map((r: any) => (typeof r === 'string' ? r.trim() : '')).filter((r: string) => !!r)
      ));
    }

    const nextRollNumbersByBatch: Record<number, string[]> = {};
    const importedBatchRolls = Array.isArray(parsed?.rollNumbers?.batches) ? parsed.rollNumbers.batches : [];
    for (const item of importedBatchRolls) {
      const batchName = typeof item?.batchName === 'string' ? item.batchName.trim() : '';
      const batchId = batchName ? batchIdByName.get(batchName) : undefined;
      if (!batchId) continue;
      const rolls = Array.isArray(item?.rollNumbers) ? item.rollNumbers : [];
      nextRollNumbersByBatch[batchId] = Array.from(new Set(
        rolls.map((r: any) => (typeof r === 'string' ? r.trim() : '')).filter((r: string) => !!r)
      ));
    }

    setProfessors(nextProfessors);
    setSubjects(nextSubjects);
    setClassrooms(nextClassrooms);
    setRollNumbersByClass(nextRollNumbersByClass);
    setRollNumbersByBatch(nextRollNumbersByBatch);
    setRollRangeByClass({});
    setRollRangeByBatch({});
    setTimetable([]); // imported stacks would otherwise mismatch old IDs
    reseedCountersFromStacks({ professors: nextProfessors, subjects: nextSubjects, classrooms: nextClassrooms });
    alert('Imported stacks successfully.');
  };

  const addEntity = (type: 'professors' | 'subjects' | 'classrooms', name: string, extra?: any) => {
    if (!user || !canEdit) return;
    if (!name.trim()) return;

    if (type === 'professors') {
      const newProfessor: Professor = { id: professorIdCounter++, name, color: extra?.color ?? COLOR_PALETTE[0] };
      setProfessors(prev => [...prev, newProfessor]);
    }

    if (type === 'subjects') {
      const newSubject: Subject = {
        id: subjectIdCounter++,
        name,
        weightage: extra?.weightage ?? 1,
        mode: extra?.mode ?? 'lecture',
        professor_id: extra?.professor_id,
        allowed_class_ids: extra?.allowed_class_ids ?? [],
        allowed_batch_ids: extra?.allowed_batch_ids ?? [],
      };
      setSubjects(prev => [...prev, newSubject]);
    }

    if (type === 'classrooms') {
      const newClassroom: Classroom = {
        id: classroomIdCounter++,
        name,
        room_type: extra?.room_type,
        allowed_subject_ids: extra?.allowed_subject_ids?.length ? extra.allowed_subject_ids : undefined,
      };
      setClassrooms(prev => [...prev, newClassroom]);
    }
  };

  const requestAddProfessor = (name: string) => {
    if (!name.trim()) return;
    setPendingProfessorName(name.trim());
    setPendingProfessorColor(COLOR_PALETTE[0]);
  };

  const finalizeAddProfessor = (color: string) => {
    if (!pendingProfessorName) return;
    addEntity('professors', pendingProfessorName, { color });
    setPendingProfessorName(null);
    setPendingProfessorColor(COLOR_PALETTE[0]);
  };

  const removeEntity = (type: 'professors' | 'subjects' | 'classrooms', id: number) => {
    if (!user || !canEdit) return;
    if (type === 'professors') setProfessors(prev => prev.filter(p => p.id !== id));
    if (type === 'subjects') setSubjects(prev => prev.filter(s => s.id !== id));
    if (type === 'classrooms') setClassrooms(prev => prev.filter(c => c.id !== id));
  };

  const onDragStart = (event: DragStartEvent) => {
    if (!user || !canEdit) return;
    const { active } = event;
    const [type, ...rest] = (active.id as string).split(':');
    let data: any = null;

    if (type === 'professor') data = professors.find(p => p.id === parseInt(rest[0]!));
    if (type === 'subject') data = subjects.find(s => s.id === parseInt(rest[0]!));
    if (type === 'classroom') data = classrooms.find(c => c.id === parseInt(rest[0]!));

    if (type === 'cellEntry') {
      const [day, slot, classId, batchId] = rest.map(v => parseInt(v));
      const entry = timetable.find(t =>
        t.day === day &&
        t.time_slot === slot &&
        t.class_id === classId &&
        t.batch_id === batchId
      );
      if (entry) {
        const subject = subjects.find(s => s.id === entry.subject_id);
        data = { name: subject?.name ?? '---' };
      }
    }

    setActiveDrag({ id: active.id as string, type, data });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    if (!canEdit) return;
    const { over, active } = event;
    setActiveDrag(null);
    if (!over || !user) return;

    const [type, ...activeParts] = (active.id as string).split(':');
    const [targetType, day, slot, classId, batchId] = (over.id as string).split(':');

    if (type === 'cellEntry' && targetType === 'cell') {
      const [fromDay, fromSlot, fromClassId, fromBatchId] = activeParts.map(v => parseInt(v));
      const entry = timetable.find(t =>
        t.day === fromDay &&
        t.time_slot === fromSlot &&
        t.class_id === fromClassId &&
        t.batch_id === fromBatchId
      );
      if (entry) {
        moveEntry(
          entry.id,
          parseInt(day),
          parseInt(slot),
          parseInt(classId),
          parseInt(batchId)
        );
      }
      return;
    }

    const entityId = activeParts[0]!;

    if (targetType === 'cell') {
      const entry = timetable.find(t => 
        t.day === parseInt(day) && 
        t.time_slot === parseInt(slot) && 
        t.class_id === parseInt(classId) && 
        t.batch_id === parseInt(batchId)
      );

      const subjectData = type === 'subject' ? subjects.find(s => s.id === parseInt(entityId)) : null;

      const update = {
        day: parseInt(day),
        time_slot: parseInt(slot),
        class_id: parseInt(classId),
        batch_id: parseInt(batchId),
        subject_id: type === 'subject' ? parseInt(entityId) : (entry?.subject_id || null),
        professor_id: type === 'subject' ? (subjectData?.professor_id || null) : (type === 'professor' ? parseInt(entityId) : (entry?.professor_id || null)),
        classroom_id: type === 'classroom' ? parseInt(entityId) : (entry?.classroom_id || null),
        exception_flag: false
      };

      saveEntry(update);
    }
  };

  const saveEntry = (entry: any) => {
    if (entry.professor_id && !entry.exception_flag) {
      const conflicting = timetable.find(t =>
        t.day === entry.day &&
        t.time_slot === entry.time_slot &&
        t.professor_id === entry.professor_id &&
        t.class_id !== entry.class_id
      );

      if (conflicting) {
        const conflictClass =
          allClasses.find(c => c.id === conflicting.class_id) ||
          classes.find(c => c.id === conflicting.class_id);

        setConflict({
          message: `Conflict detected: Professor is already assigned to ${conflictClass?.name ?? 'another class'} at this time.`,
          data: entry,
        });
        return;
      }
    }

    setTimetable(prev => {
      const idx = prev.findIndex(t =>
        t.day === entry.day &&
        t.time_slot === entry.time_slot &&
        t.class_id === entry.class_id &&
        t.batch_id === entry.batch_id
      );

      if (idx !== -1) {
        const existing = prev[idx];
        const updated: TimetableEntry = {
          ...existing,
          ...entry,
          id: existing.id,
          exception_flag: !!entry.exception_flag,
        };
        const next = [...prev];
        next[idx] = updated;
        return next;
      }

      const newEntry: TimetableEntry = {
        id: timetableEntryIdCounter++,
        day: entry.day,
        time_slot: entry.time_slot,
        class_id: entry.class_id,
        batch_id: entry.batch_id,
        subject_id: entry.subject_id ?? null,
        professor_id: entry.professor_id ?? null,
        classroom_id: entry.classroom_id ?? null,
        exception_flag: !!entry.exception_flag,
      };

      return [...prev, newEntry];
    });
  };

  const clearCell = (day: number, slot: number, classId: number, batchId: number) => {
    if (!user || !canEdit) return;
    setTimetable(prev =>
      prev.filter(t =>
        !(t.day === day && t.time_slot === slot && t.class_id === classId && t.batch_id === batchId)
      )
    );
  };

  const updateEntity = (type: 'subjects', id: number, data: any) => {
    if (!user || !canEdit) return;
    if (type === 'subjects') {
      setSubjects(prev => prev.map(s => (s.id === id ? { ...s, ...data } : s)));
    }
  };

  const moveEntry = (entryId: number, day: number, slot: number, classId: number, batchId: number) => {
    const existing = timetable.find(t => t.id === entryId);
    if (!existing) return;

    const updated: TimetableEntry = {
      ...existing,
      day,
      time_slot: slot,
      class_id: classId,
      batch_id: batchId,
    };

    if (updated.professor_id && !updated.exception_flag) {
      const conflicting = timetable.find(t =>
        t.id !== updated.id &&
        t.day === updated.day &&
        t.time_slot === updated.time_slot &&
        t.professor_id === updated.professor_id &&
        t.class_id !== updated.class_id
      );

      if (conflicting) {
        const conflictClass =
          allClasses.find(c => c.id === conflicting.class_id) ||
          classes.find(c => c.id === conflicting.class_id);

        setConflict({
          message: `Conflict detected: Professor is already assigned to ${conflictClass?.name ?? 'another class'} at this time.`,
          data: updated,
        });
        return;
      }
    }

    setTimetable(prev =>
      prev.map(t => (t.id === entryId ? updated : t))
    );
  };

  const autoCreate = () => {
    if (!user || !canEdit) return;
    if (subjects.length === 0) {
      alert("Please add some subjects first.");
      return;
    }

    const newEntries: TimetableEntry[] = [];
    const profSchedule: Record<string, boolean> = {}; // "day:slot:profId"
    const roomSchedule: Record<string, boolean> = {}; // "day:slot:roomId"
    const autoErrors: string[] = [];
    const MAX_HOURS_PER_DAY = 2;

    let lunchProfessor = professors.find(p => p.name === 'Lunch' && p.color === LUNCH_COLOR);
    if (!lunchProfessor) {
      lunchProfessor = { id: professorIdCounter++, name: 'Lunch', color: LUNCH_COLOR };
      setProfessors(prev => [...prev, lunchProfessor!]);
    }
    let lunchSubject = subjects.find(s => s.name === 'Lunch');
    if (!lunchSubject) {
      lunchSubject = { id: subjectIdCounter++, name: 'Lunch', weightage: 0, mode: 'lecture' as const };
      setSubjects(prev => [...prev, lunchSubject!]);
    }
    const reservedLunchSlotsByClassDay = new Set<string>(); // classId:day:slot
    const occupied = new Set<string>();
    for (let classIdx = 0; classIdx < classes.length; classIdx++) {
      const cls = classes[classIdx]!;
      for (let day = 0; day < 5; day++) {
        const preferred = (classIdx + day) % 2 === 0 ? LUNCH_SLOT_12_1 : LUNCH_SLOT_1_2;
        const alternate = preferred === LUNCH_SLOT_12_1 ? LUNCH_SLOT_1_2 : LUNCH_SLOT_12_1;
        const candidates = [preferred, alternate];
        let selectedSlot: number | null = null;
        for (const slot of candidates) {
          const freeForAllBatches = cls.batches.every(batch => !occupied.has(`${day}:${slot}:${cls.id}:${batch.id}`));
          if (freeForAllBatches) {
            selectedSlot = slot;
            break;
          }
        }
        if (selectedSlot == null) {
          autoErrors.push(`${cls.name}: could not place Lunch on ${DAYS[day]}.`);
          continue;
        }
        reservedLunchSlotsByClassDay.add(`${cls.id}:${day}:${selectedSlot}`);
        for (const batch of cls.batches) {
          occupied.add(`${day}:${selectedSlot}:${cls.id}:${batch.id}`);
          newEntries.push({
            id: timetableEntryIdCounter++,
            day,
            time_slot: selectedSlot,
            class_id: cls.id,
            batch_id: batch.id,
            subject_id: lunchSubject!.id,
            professor_id: lunchProfessor!.id,
            classroom_id: null,
            exception_flag: false,
          });
        }
      }
    }

    // For each class and its batches (after lunch reservation)
    for (const cls of classes) {
      const dayOrder = [0, 1, 2, 3, 4];
      dayOrder.sort(() => Math.random() - 0.5);
      let classSlots: { day: number, slot: number }[] = [];
      for (const d of dayOrder) {
        for (let s = 0; s < 8; s++) {
          if (reservedLunchSlotsByClassDay.has(`${cls.id}:${d}:${s}`)) continue;
          classSlots.push({ day: d, slot: s });
        }
      }

      const lectureHoursPerSubjectPerDay: Record<string, number> = {};
      const lectureKey = (subId: number, day: number) => `${cls.id}:${subId}:${day}`;

      for (const sub of subjects) {
        if (sub.allowed_class_ids && sub.allowed_class_ids.length > 0 && !sub.allowed_class_ids.includes(cls.id)) {
          continue;
        }
        const mode = sub.mode ?? 'lecture';

        if (mode === 'lecture') {
          for (let h = 0; h < sub.weightage; h++) {
            if (classSlots.length === 0) break;
            let found = false;
            let attempts = 0;

            while (!found && attempts < classSlots.length) {
              const { day, slot } = classSlots[0];
              const subjectDayCount = lectureHoursPerSubjectPerDay[lectureKey(sub.id, day)] ?? 0;
              if (subjectDayCount >= MAX_HOURS_PER_DAY) {
                classSlots.push(classSlots.shift()!);
                attempts++;
                continue;
              }

              const profId = sub.professor_id || (professors[Math.floor(Math.random() * professors.length)]?.id);
              const lectureRooms = classrooms.filter(r => r.room_type !== 'lab');
              const eligibleRooms = lectureRooms.filter(r => !r.allowed_subject_ids?.length || r.allowed_subject_ids.includes(sub.id));
              const pool = eligibleRooms.length ? eligibleRooms : lectureRooms;
              const room = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;

              const profKey = `${day}:${slot}:${profId}`;
              const roomKey = `${day}:${slot}:${room?.id}`;
              const profBusy = !!(profId && profSchedule[profKey]);
              const roomBusy = !!(room && roomSchedule[roomKey]);

              if (!profBusy && !roomBusy) {
                for (const batch of cls.batches) {
                  newEntries.push({
                    id: timetableEntryIdCounter++,
                    day,
                    time_slot: slot,
                    class_id: cls.id,
                    batch_id: batch.id,
                    subject_id: sub.id,
                    professor_id: profId || null,
                    classroom_id: room?.id || null,
                    exception_flag: false,
                  });
                  occupied.add(`${day}:${slot}:${cls.id}:${batch.id}`);
                }
                lectureHoursPerSubjectPerDay[lectureKey(sub.id, day)] = subjectDayCount + 1;
                if (profId) profSchedule[profKey] = true;
                if (room) roomSchedule[roomKey] = true;
                found = true;
                classSlots.shift();
              } else {
                classSlots.push(classSlots.shift()!);
                attempts++;
              }
            }
            if (!found) autoErrors.push(`${cls.name}: could not place lecture ${sub.name} (${h + 1}/${sub.weightage}).`);
          }
        } else {
          const labHoursPerSubjectPerDay: Record<string, number> = {};
          const labKey = (batchId: number, day: number) => `${cls.id}:${batchId}:${sub.id}:${day}`;

          for (const batch of cls.batches) {
            if (sub.allowed_batch_ids && sub.allowed_batch_ids.length > 0 && !sub.allowed_batch_ids.includes(batch.id)) continue;
            let availableSlots = [...classSlots];
            for (let h = 0; h < sub.weightage; h++) {
              if (availableSlots.length === 0) break;
              let found = false;
              let attempts = 0;

              while (!found && attempts < availableSlots.length) {
                const { day, slot } = availableSlots[0];
                const subjectDayCount = labHoursPerSubjectPerDay[labKey(batch.id, day)] ?? 0;
                if (subjectDayCount >= MAX_HOURS_PER_DAY) {
                  availableSlots.push(availableSlots.shift()!);
                  attempts++;
                  continue;
                }

                const profId = sub.professor_id || (professors[Math.floor(Math.random() * professors.length)]?.id);
                const labRooms = classrooms.filter(r => r.room_type === 'lab');
                const eligibleRooms = labRooms.filter(r => !r.allowed_subject_ids?.length || r.allowed_subject_ids.includes(sub.id));
                const pool = eligibleRooms.length ? eligibleRooms : labRooms;
                const room = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;

                const profKey = `${day}:${slot}:${profId}`;
                const roomKey = `${day}:${slot}:${room?.id}`;
                const profBusy = !!(profId && profSchedule[profKey]);
                const roomBusy = !!(room && roomSchedule[roomKey]);

                if (!profBusy && !roomBusy) {
                  newEntries.push({
                    id: timetableEntryIdCounter++,
                    day,
                    time_slot: slot,
                    class_id: cls.id,
                    batch_id: batch.id,
                    subject_id: sub.id,
                    professor_id: profId || null,
                    classroom_id: room?.id || null,
                    exception_flag: false,
                  });
                  occupied.add(`${day}:${slot}:${cls.id}:${batch.id}`);
                  labHoursPerSubjectPerDay[labKey(batch.id, day)] = subjectDayCount + 1;
                  if (profId) profSchedule[profKey] = true;
                  if (room) roomSchedule[roomKey] = true;
                  found = true;
                  availableSlots.shift();
                } else {
                  availableSlots.push(availableSlots.shift()!);
                  attempts++;
                }
              }
              if (!found) autoErrors.push(`${cls.name} ${batch.name}: could not place lab ${sub.name} (${h + 1}/${sub.weightage}).`);
            }
          }
        }
      }
    }

    setTimetable(newEntries);
    setAutoCreateErrors(autoErrors);
  };

  const parseRollRangeInput = (value: string) => {
    const tokens = value.split(',').map((x) => x.trim()).filter(Boolean);
    const out: string[] = [];
    for (const token of tokens) {
      const m = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let start = Number(m[1]);
        let end = Number(m[2]);
        if (Number.isNaN(start) || Number.isNaN(end)) continue;
        if (start > end) [start, end] = [end, start];
        for (let i = start; i <= end; i++) out.push(String(i));
        continue;
      }
      if (/^\d+$/.test(token)) out.push(token);
    }
    return Array.from(new Set(out));
  };

  const getClassRollsFromBatches = (classId: number) => {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return rollNumbersByClass[classId] ?? [];
    const merged = cls.batches.flatMap((b) => rollNumbersByBatch[b.id] ?? []);
    return Array.from(new Set(merged));
  };

  const getAttendanceContext = (entry: TimetableEntry) => {
    const subject = subjects.find((s) => s.id === entry.subject_id);
    const mode = subject?.mode ?? 'lecture';
    if (mode === 'lab') {
      return {
        mode,
        scopeLabel: 'Batch-wise',
        rolls: (rollNumbersByBatch[entry.batch_id] ?? rollNumbersByClass[entry.class_id] ?? []),
        key: `${mondayDate}:${entry.day}:${entry.time_slot}:${entry.class_id}:${entry.batch_id}:lab`,
      };
    }
    return {
      mode,
      scopeLabel: 'Class-wise',
      rolls: getClassRollsFromBatches(entry.class_id),
      key: `${mondayDate}:${entry.day}:${entry.time_slot}:${entry.class_id}:lecture`,
    };
  };

  const openAttendance = (entry: TimetableEntry) => {
    const ctx = getAttendanceContext(entry);
    const existing = attendanceRecords[ctx.key] ?? {};
    const seed: Record<string, boolean> = {};
    for (const roll of ctx.rolls) seed[roll] = !!existing[roll];
    setAttendanceTarget(entry);
    setAttendanceMarks(seed);
  };

  const saveAttendance = () => {
    if (!attendanceTarget) return;
    const ctx = getAttendanceContext(attendanceTarget);
    const absentOnly = Object.fromEntries(
      Object.entries(attendanceMarks).filter(([, isAbsent]) => !!isAbsent)
    );
    setAttendanceRecords((prev) => ({ ...prev, [ctx.key]: absentOnly }));
    setAttendanceTarget(null);
  };

  const selectedMonthKey = mondayDate.slice(0, 7); // YYYY-MM
  const canEdit = userRole === 'incharge';
  const canNavigateSchedule = !!userRole;

  const logout = () => {
    setUserRole(null);
    setLoginStep('choose');
    setInchargePassword('');
    setInchargeError('');
    setProfessorPassword('');
    setProfessorError('');
    setAttendanceTarget(null);
    setConflict(null);
    setIsProfessorModalOpen(false);
  };
  const monthlyLectureDefaulters = React.useMemo(() => {
    const absentsByClassRoll: Record<number, Record<string, number>> = {};
    const monthlyLectureSessionsByClass: Record<number, number> = {};

    for (const [key, marks] of Object.entries(attendanceRecords)) {
      const parts = key.split(':');
      if (parts.length < 5) continue;
      const weekStart = parts[0]!;
      const classId = Number(parts[3]);
      const scope = parts[parts.length - 1];
      if (!weekStart.startsWith(selectedMonthKey)) continue;
      if (scope !== 'lecture') continue;
      if (!Number.isInteger(classId)) continue;

      monthlyLectureSessionsByClass[classId] = (monthlyLectureSessionsByClass[classId] ?? 0) + 1;
      const absentRolls = Object.keys(marks);
      if (!absentsByClassRoll[classId]) absentsByClassRoll[classId] = {};
      for (const roll of absentRolls) {
        absentsByClassRoll[classId]![roll] = (absentsByClassRoll[classId]![roll] ?? 0) + 1;
      }
    }

    return classes.map((cls) => {
      const classId = cls.id;
      const totalLectures = monthlyLectureSessionsByClass[classId] ?? 0;
      const rolls = getClassRollsFromBatches(classId);

      const lowAttendanceRolls = rolls
        .map((roll) => {
          const absent = absentsByClassRoll[classId]?.[roll] ?? 0;
          const present = Math.max(0, totalLectures - absent);
          const pct = totalLectures > 0 ? (present / totalLectures) * 100 : 100;
          return { roll, pct, present, total: totalLectures };
        })
        .filter((r) => r.pct < 75)
        .sort((a, b) => a.pct - b.pct);

      return {
        classId,
        className: cls.name,
        totalLectures,
        lowAttendanceRolls,
      };
    });
  }, [attendanceRecords, classes, rollNumbersByBatch, rollNumbersByClass, selectedMonthKey]);

  const updateMonthlyAttendance = () => {
    setMonthlyAttendanceSnapshots((prev) => ({
      ...prev,
      [selectedMonthKey]: {
        updatedAt: new Date().toISOString(),
        classes: monthlyLectureDefaulters,
      },
    }));
  };

  const monthlyAttendanceToShow = monthlyAttendanceSnapshots[selectedMonthKey]?.classes ?? monthlyLectureDefaulters;
  const monthlyAttendanceUpdatedAt = monthlyAttendanceSnapshots[selectedMonthKey]?.updatedAt;

  if (!userRole) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center bg-deep-navy p-4", theme === 'light' && "theme-light")}>
        {loginStep === 'choose' && (
          <div className="w-full max-w-xs flex flex-col gap-3">
            <div className="rounded-xl border border-border-blue-gray bg-midnight-blue shadow-lg overflow-hidden p-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setLoginStep('under_construction')}
                className="w-full py-4 px-6 text-left text-sm font-medium text-muted-teal hover:bg-slate-blue rounded-lg transition-colors"
              >
                Student Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfessorPassword('');
                  setProfessorError('');
                  setLoginStep('professor_password');
                }}
                className="w-full py-4 px-6 text-left text-sm font-medium text-muted-teal hover:bg-slate-blue rounded-lg transition-colors"
              >
                Professor Login
              </button>
              <button
                type="button"
                onClick={() => setLoginStep('incharge_password')}
                className="w-full py-4 px-6 text-left text-sm font-medium text-muted-teal hover:bg-slate-blue rounded-lg transition-colors"
              >
                Incharge Login
              </button>
            </div>
          </div>
        )}
        {loginStep === 'incharge_password' && (
          <div className="w-full max-w-xs flex flex-col gap-4">
            <div className="rounded-xl border border-border-blue-gray bg-midnight-blue shadow-lg p-6 flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-muted-teal">Incharge login</h2>
              <input
                type="password"
                value={inchargePassword}
                onChange={(e) => {
                  setInchargePassword(e.target.value);
                  setInchargeError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (inchargePassword.trim() === 'timecardsadmin') {
                      setUserRole('incharge');
                      setInchargeError('');
                    } else {
                      setInchargeError('Invalid password');
                    }
                  }
                }}
                placeholder="Enter password"
                className="w-full text-sm border border-border-blue-gray bg-deep-navy text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-muted-teal"
                autoFocus
              />
              {inchargeError && (
                <p className="text-xs text-red-400">{inchargeError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLoginStep('choose')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium border border-border-blue-gray text-muted-steel hover:bg-slate-blue rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (inchargePassword.trim() === 'timecardsadmin') {
                      setUserRole('incharge');
                      setInchargeError('');
                    } else {
                      setInchargeError('Invalid password');
                    }
                  }}
                  className="flex-1 py-2 text-sm font-medium bg-muted-teal text-deep-navy rounded-lg hover:opacity-90 transition-opacity"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
        {loginStep === 'professor_password' && (
          <div className="w-full max-w-xs flex flex-col gap-4">
            <div className="rounded-xl border border-border-blue-gray bg-midnight-blue shadow-lg p-6 flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-muted-teal">Professor login</h2>
              <input
                type="password"
                value={professorPassword}
                onChange={(e) => {
                  setProfessorPassword(e.target.value);
                  setProfessorError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (professorPassword.trim() === 'timecardsprof') {
                      setUserRole('professor');
                      setProfessorError('');
                    } else {
                      setProfessorError('Invalid password');
                    }
                  }
                }}
                placeholder="Enter password"
                className="w-full text-sm border border-border-blue-gray bg-deep-navy text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-muted-teal"
                autoFocus
              />
              {professorError && (
                <p className="text-xs text-red-400">{professorError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLoginStep('choose')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium border border-border-blue-gray text-muted-steel hover:bg-slate-blue rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (professorPassword.trim() === 'timecardsprof') {
                      setUserRole('professor');
                      setProfessorError('');
                    } else {
                      setProfessorError('Invalid password');
                    }
                  }}
                  className="flex-1 py-2 text-sm font-medium bg-muted-teal text-deep-navy rounded-lg hover:opacity-90 transition-opacity"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
        {loginStep === 'under_construction' && (
          <div className="w-full max-w-xs flex flex-col gap-4">
            <div className="rounded-xl border border-border-blue-gray bg-midnight-blue shadow-lg p-8 flex flex-col gap-6 items-center text-center">
              <p className="text-muted-teal font-medium">Under construction</p>
              <button
                type="button"
                onClick={() => setLoginStep('choose')}
                className="flex items-center gap-2 py-2 px-4 text-sm font-medium border border-border-blue-gray text-muted-steel hover:bg-slate-blue rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className={cn("min-h-screen flex flex-col no-print", theme === 'light' && "theme-light")}>
        {/* Top Bar */}
        <header className="h-16 bg-midnight-blue border-b border-border-blue-gray px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-serif font-bold text-muted-teal tracking-tight">TIMECARDS</h1>
            <div className="relative group">
              <button className="flex items-center gap-2 text-sm font-medium hover:text-muted-teal transition-colors">
                Attendance <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 mt-1 bg-midnight-blue border border-border-blue-gray shadow-none rounded-md py-2 w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-40">
                <div className="px-4 py-1 text-xs text-muted-teal font-semibold">
                  Monthly Lecture Attendance ({selectedMonthKey})
                </div>
                <button
                  disabled={!canEdit}
                  onClick={updateMonthlyAttendance}
                  className="w-full text-left px-4 py-2 text-xs text-muted-teal hover:bg-slate-blue border-t border-border-blue-gray disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Update Monthly Attendance
                </button>
                <div className="px-4 py-1 text-[10px] text-muted-steel">
                  {monthlyAttendanceUpdatedAt
                    ? `Last updated: ${new Date(monthlyAttendanceUpdatedAt).toLocaleString()}`
                    : 'Using live data (not manually updated yet)'}
                </div>
                <div className="border-t border-border-blue-gray mt-1 pt-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {monthlyAttendanceToShow.every((c) => c.lowAttendanceRolls.length === 0) && (
                    <div className="px-4 py-2 text-xs text-muted-steel">No students below 75% lecture attendance this month.</div>
                  )}
                  {monthlyAttendanceToShow.map((c) => (
                    <div key={c.classId} className="px-4 py-2 border-b border-border-blue-gray/40 last:border-b-0">
                      <div className="text-xs text-muted-teal font-semibold">
                        {c.className} ({c.totalLectures} lectures)
                      </div>
                      {c.lowAttendanceRolls.length === 0 ? (
                        <div className="text-[10px] text-muted-steel mt-1">No defaulters</div>
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          {c.lowAttendanceRolls.map((r) => (
                            <div key={`${c.classId}-${r.roll}`} className="text-[10px] text-muted-steel">
                              {r.roll}: {r.pct.toFixed(1)}% ({r.present}/{r.total})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-2 text-sm font-medium hover:text-muted-teal transition-colors">
                {selectedYear?.name} <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 mt-1 bg-midnight-blue border border-border-blue-gray shadow-none rounded-md py-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {years.map(y => (
                  <button 
                    key={y.id} 
                    disabled={!canEdit}
                    onClick={() => canEdit && setSelectedYear(y)}
                    className={cn("w-full text-left px-4 py-2 text-sm hover:bg-slate-blue", selectedYear?.id === y.id && "bg-slate-blue font-semibold")}
                  >
                    Year {y.name}
                  </button>
                ))}
                <div className="border-t border-border-blue-gray mt-2 pt-2">
                  <button 
                    disabled={!canEdit}
                    onClick={() => canEdit && setIsProfessorModalOpen(true)}
                    className="w-full text-left px-4 py-2 text-sm text-muted-teal flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <UserIcon className="w-4 h-4" /> Manage Professors
                  </button>
                  <button 
                    disabled={!canEdit}
                    onClick={async () => {
                      if (!canEdit) return;
                      const name = prompt("Enter new year (e.g. 2026):");
                      if (name) {
                        const newYearId = yearIdCounter++;
                        const newYear: Year = { id: newYearId, name };

                        const newClasses: ClassWithBatches[] = [];
                        for (let i = 1; i <= 8; i++) {
                          const classId = classIdCounter++;
                          const prefix = String.fromCharCode(64 + i);
                          const batches = [];
                          for (let b = 1; b <= 3; b++) {
                            batches.push({
                              id: batchIdCounter++,
                              class_id: classId,
                              name: `${prefix}${b}`,
                            });
                          }
                          newClasses.push({
                            id: classId,
                            year_id: newYearId,
                            name: `Class ${i}`,
                            batches,
                          });
                        }

                        setYears([...years, newYear]);
                        setAllClasses(prev => [...prev, ...newClasses]);
                        setSelectedYear(newYear);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-muted-teal flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" /> Add Year
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="text-sm font-medium text-muted-steel uppercase tracking-widest">
              {DAYS[activeDay]} Schedule
            </div>
            <div className="text-sm font-mono text-muted-teal">
              {getDateForDay(activeDay)}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-steel uppercase font-bold">Week of:</span>
              <input 
                type="date" 
                value={mondayDate}
                disabled={!canNavigateSchedule}
                onChange={(e) => canNavigateSchedule && setMondayDate(e.target.value)}
                className="bg-deep-navy border border-border-blue-gray text-[10px] text-white p-1 rounded focus:outline-none focus:ring-1 focus:ring-muted-teal"
              />
            </div>
            <button
              type="button"
              onClick={logout}
              className="text-[10px] uppercase tracking-widest text-muted-steel hover:text-muted-teal border border-border-blue-gray rounded px-2 py-1 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative">
          {/* Timetable Grid */}
          <div className="flex-1 overflow-auto p-8 bg-deep-navy">
              <div className={cn("mx-auto", !isSidebarCollapsed && "max-w-7xl")}>
              {/* Day Tabs */}
              <div className="flex gap-1 mb-8">
                {DAYS.map((day, idx) => (
                  <button
                    key={day}
                    disabled={!canNavigateSchedule}
                    onClick={() => canNavigateSchedule && setActiveDay(idx)}
                    className={cn(
                      "px-6 py-2 text-sm font-medium rounded-t-md transition-all border-b-2",
                      !canNavigateSchedule && "opacity-40 cursor-not-allowed",
                      activeDay === idx 
                        ? "bg-midnight-blue border-muted-teal text-muted-teal shadow-none" 
                        : "text-muted-steel border-transparent hover:bg-midnight-blue/50"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Grid */}
              <div className="bg-midnight-blue border border-border-blue-gray shadow-none rounded-lg overflow-hidden">
                <table className="w-full institutional-grid table-fixed">
                  <thead>
                    <tr className="bg-deep-navy">
                      <th className="w-32 text-xs font-semibold text-muted-steel uppercase">Class</th>
                      <th className="w-16 text-xs font-semibold text-muted-steel uppercase">Batch</th>
                      {TIME_SLOTS.map(slot => (
                        <th key={slot} className="text-xs font-semibold text-muted-steel uppercase">{slot}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((cls) => (
                      <React.Fragment key={cls.id}>
                        {cls.batches.map((batch, bIdx) => (
                          <tr key={batch.id}>
                            {bIdx === 0 && (
                              <td rowSpan={cls.batches.length} className="font-semibold text-center align-middle bg-deep-navy/30">
                                {cls.name}
                              </td>
                            )}
                            <td className="text-center text-xs font-medium text-muted-steel bg-deep-navy/10">
                              {batch.name}
                            </td>
                            {TIME_SLOTS.map((_, sIdx) => {
                              const entry = timetable.find(t => 
                                t.day === activeDay && 
                                t.time_slot === sIdx && 
                                t.class_id === cls.id && 
                                t.batch_id === batch.id
                              );
                              const cellId = `cell:${activeDay}:${sIdx}:${cls.id}:${batch.id}`;
                              
                              return (
                                <td key={sIdx} className="p-0 relative">
                                  <DroppableCellWrapper id={cellId}>
                                    <DroppableCell 
                                      day={activeDay}
                                      slotIdx={sIdx}
                                      classId={cls.id}
                                      batchId={batch.id}
                                      entry={entry}
                                      onClear={() => clearCell(activeDay, sIdx, cls.id, batch.id)}
                                      onOpenAttendance={() => entry && openAttendance(entry)}
                                      readOnly={!canEdit}
                                      professors={professors}
                                      subjects={subjects}
                                      classrooms={classrooms}
                                    />
                                  </DroppableCellWrapper>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <AnimatePresence initial={false}>
            {!isSidebarCollapsed && (
              <motion.aside
                initial={{ x: 0 }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.2 }}
                className="w-80 border-l border-border-blue-gray bg-midnight-blue p-6 overflow-y-auto flex flex-col"
              >
                <div className="mb-8 pb-8 border-b border-border-blue-gray space-y-3">
                  <button 
                    disabled={!canEdit}
                    onClick={autoCreate}
                    className="w-full btn-teal py-4 flex items-center justify-center gap-2 shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    AUTO-CREATE TIMETABLE
                  </button>
                  {autoCreateErrors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-border-blue-gray rounded-md p-2 bg-deep-navy/40 space-y-1 custom-scrollbar">
                      <div className="text-[10px] uppercase tracking-widest text-red-300">Auto-create issues</div>
                      {autoCreateErrors.map((err, idx) => (
                        <div key={`${idx}-${err}`} className="text-[10px] text-muted-steel">
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <SidebarSection 
                    title="Subjects & Professors" 
                    items={subjects} 
                    type="subject" 
                    onAdd={(name, extra) => addEntity('subjects', name, extra)}
                    onRemove={(id) => removeEntity('subjects', id)}
                    onUpdate={(type, id, data) => updateEntity(type as any, id, data)}
                    professors={professors}
                    onRequestAddProfessor={requestAddProfessor}
                    classes={classes}
                    disabled={!canEdit}
                  />
                  <div className="border-t border-border-blue-gray my-8" />
                  <SidebarSection 
                    title="Classrooms" 
                    items={classrooms} 
                    type="classroom" 
                    onAdd={(name, extra) => addEntity('classrooms', name, extra)}
                    onRemove={(id) => removeEntity('classrooms', id)}
                    subjects={subjects}
                    disabled={!canEdit}
                  />
                  <div className="border-t border-border-blue-gray my-4" />
                  <div className="pt-4 space-y-3">
                    <h4 className="text-[10px] text-muted-steel text-center uppercase tracking-widest">Roll Numbers (Attendance)</h4>
                    <RollNumberManager
                      classes={classes}
                      rollRangeByClass={rollRangeByClass}
                      rollRangeByBatch={rollRangeByBatch}
                      rollNumbersByClass={rollNumbersByClass}
                      rollNumbersByBatch={rollNumbersByBatch}
                      disabled={!canEdit}
                      onUpdateBatchRange={(batchId, range) => {
                        if (!canEdit) return;
                        const generated = parseRollRangeInput(range);
                        setRollRangeByBatch((prev) => ({ ...prev, [batchId]: range }));
                        setRollNumbersByBatch((prev) => {
                          const next = { ...prev, [batchId]: generated };
                          const ownerClass = classes.find((c) => c.batches.some((b) => b.id === batchId));
                          if (ownerClass) {
                            const classMerged = Array.from(new Set(
                              ownerClass.batches.flatMap((b) => next[b.id] ?? [])
                            ));
                            setRollNumbersByClass((classPrev) => ({ ...classPrev, [ownerClass.id]: classMerged }));
                          }
                          return next;
                        });
                      }}
                    />
                  </div>
                  <div className="border-t border-border-blue-gray my-4" />
                  <div className="pt-4 space-y-2">
                    <input
                      ref={importInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const text = await file.text();
                          importStacksFromText(text);
                        } finally {
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <button
                      disabled={!canEdit}
                      onClick={exportStacksToFile}
                      className="w-full btn-outline py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      SAVE STACKS (EXPORT)
                    </button>
                    <button
                      disabled={!canEdit}
                      onClick={() => canEdit && importInputRef.current?.click()}
                      className="w-full btn-outline py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      IMPORT STACKS
                    </button>
                    <p className="text-[10px] text-muted-steel text-center uppercase tracking-widest">
                      Saves Subjects, Professors, Classrooms, Roll Numbers
                    </p>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Sidebar toggle handle - moves with sidebar collapse */}
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => canEdit && setIsSidebarCollapsed((v) => !v)}
            className={cn(
              "absolute top-6 -translate-x-1/2 z-20 bg-midnight-blue border border-border-blue-gray rounded-full w-7 h-7 flex items-center justify-center hover:bg-slate-blue transition-all duration-200",
              !canEdit && "opacity-40 cursor-not-allowed",
              isSidebarCollapsed ? "right-0" : "right-80"
            )}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <ChevronLeft className="w-4 h-4 text-muted-steel" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-steel" />
            )}
          </button>
        </main>

        {/* Theme settings button */}
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => canEdit && setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
          className="fixed bottom-4 right-4 z-40 bg-midnight-blue border border-border-blue-gray rounded-full w-10 h-10 flex items-center justify-center hover:bg-slate-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Toggle theme"
        >
          <Settings className="w-5 h-5 text-muted-steel" />
        </button>

        {/* Conflict Modal */}
        <AnimatePresence>
          {conflict && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-navy/80">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-midnight-blue rounded-lg shadow-none border border-border-blue-gray w-full max-w-md p-6"
              >
                <div className="flex items-center gap-3 text-muted-teal mb-4">
                  <AlertCircle className="w-6 h-6" />
                  <h3 className="text-lg font-semibold">Conflict Detected</h3>
                </div>
                <p className="text-muted-steel mb-6">{conflict.message}</p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      saveEntry({ ...conflict.data, exception_flag: true });
                      setConflict(null);
                    }}
                    className="btn-teal bg-slate-blue hover:bg-slate-blue/90"
                  >
                    Allow Exception
                  </button>
                  <button 
                    onClick={() => setConflict(null)}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Attendance Modal */}
        <AnimatePresence>
          {attendanceTarget && (() => {
            const ctx = getAttendanceContext(attendanceTarget);
            const cls = classes.find(c => c.id === attendanceTarget.class_id) || allClasses.find(c => c.id === attendanceTarget.class_id);
            const batch = cls?.batches.find(b => b.id === attendanceTarget.batch_id);
            const subject = subjects.find(s => s.id === attendanceTarget.subject_id);
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-navy/80">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-midnight-blue rounded-lg shadow-none border border-border-blue-gray w-full max-w-md p-6"
                >
                  <h3 className="text-lg font-semibold text-muted-teal mb-1">Attendance</h3>
                  <p className="text-xs text-muted-steel mb-4">
                    {subject?.name ?? 'Subject'} - {ctx.scopeLabel} ({cls?.name ?? 'Class'}{ctx.mode === 'lab' ? ` / ${batch?.name ?? 'Batch'}` : ''})
                  </p>
                  <p className="text-[10px] text-muted-steel mb-2 uppercase tracking-widest">Mark only absentees</p>
                  <div className="flex gap-2 mb-2">
                    <button
                      className="flex-1 btn-outline py-1 text-xs"
                      onClick={() => {
                        const reset: Record<string, boolean> = {};
                        for (const roll of ctx.rolls) reset[roll] = false;
                        setAttendanceMarks(reset);
                      }}
                    >
                      Mark all present
                    </button>
                    <button
                      className="flex-1 btn-outline py-1 text-xs"
                      onClick={() => {
                        const reset: Record<string, boolean> = {};
                        for (const roll of ctx.rolls) reset[roll] = false;
                        setAttendanceMarks(reset);
                      }}
                    >
                      Clear absentees
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto border border-border-blue-gray rounded-md p-2 space-y-1">
                    {ctx.rolls.length === 0 && (
                      <div className="text-xs text-muted-steel p-2">No roll numbers found. Add them in the sidebar Roll Numbers section.</div>
                    )}
                    {ctx.rolls.map(roll => (
                      <label key={roll} className="flex items-center gap-2 text-sm p-1.5 hover:bg-slate-blue rounded">
                        <input
                          type="checkbox"
                          checked={!!attendanceMarks[roll]}
                          onChange={(e) => setAttendanceMarks(prev => ({ ...prev, [roll]: e.target.checked }))}
                        />
                        <span>{roll} <span className="text-[10px] text-muted-steel">(absent)</span></span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="flex-1 btn-outline" onClick={() => setAttendanceTarget(null)}>Cancel</button>
                    <button className="flex-1 btn-teal" onClick={saveAttendance}>Save Attendance</button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDrag ? (
            <div className="chip opacity-80 shadow-none border-muted-teal">
              <GripVertical className="w-4 h-4 text-muted-steel opacity-40 mr-2" />
              {activeDrag.data.name}
            </div>
          ) : null}
        </DragOverlay>

        {/* Professor Management Modal */}
        <AnimatePresence>
          {isProfessorModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-navy/80 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-midnight-blue rounded-lg shadow-none border border-border-blue-gray w-full max-w-lg p-6 flex flex-col max-h-[80vh]"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3 text-muted-teal">
                    <UserIcon className="w-6 h-6" />
                    <h3 className="text-lg font-semibold">Manage Professors</h3>
                  </div>
                  <button onClick={() => setIsProfessorModalOpen(false)} className="p-2 hover:bg-slate-blue rounded transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 text-sm border border-border-blue-gray bg-deep-navy text-white p-2 rounded focus:outline-none focus:ring-1 focus:ring-muted-teal"
                      placeholder="Add new professor name..."
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          requestAddProfessor(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {professors.map(prof => (
                    <div key={prof.id} className="flex items-center justify-between p-3 bg-deep-navy border border-border-blue-gray rounded-md group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-border-blue-gray shrink-0"
                          style={{ backgroundColor: prof.color }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium truncate">{prof.name}</span>
                      </div>
                      <button 
                        onClick={() => removeEntity('professors', prof.id)}
                        className="p-1.5 text-muted-steel hover:text-red-400 hover:bg-slate-blue rounded transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {professors.length === 0 && (
                    <div className="text-center py-8 text-muted-steel text-sm italic">
                      No professors added yet.
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-border-blue-gray">
                  <button 
                    onClick={() => setIsProfessorModalOpen(false)}
                    className="w-full btn-teal"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Color Picker (Professor) */}
        <AnimatePresence>
          {pendingProfessorName && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-deep-navy/80 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                className="bg-midnight-blue rounded-lg shadow-none border border-border-blue-gray w-full max-w-md p-6"
              >
                <div className="mb-4">
                  <div className="text-muted-teal text-sm font-semibold">Pick a color</div>
                  <div className="text-xs text-muted-steel mt-1 truncate">
                    Professor: <span className="text-white font-medium">{pendingProfessorName}</span>
                  </div>
                </div>

                <div className="mb-6 flex flex-col items-center justify-center gap-3">
                  <input
                    type="color"
                    value={pendingProfessorColor}
                    onChange={(e) => setPendingProfessorColor(e.target.value)}
                    className="w-24 h-24 bg-transparent border border-border-blue-gray rounded-full cursor-pointer"
                    aria-label="Pick professor color"
                  />
                  <div className="text-xs text-muted-steel font-mono uppercase tracking-widest">
                    {pendingProfessorColor}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingProfessorName(null)}
                    className="flex-1 btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => finalizeAddProfessor(pendingProfessorColor)}
                    className="flex-1 btn-teal"
                  >
                    OK
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DndContext>
  );
}

// --- Helper Components ---

import { useDroppable, useDraggable } from '@dnd-kit/core';

const DroppableCellWrapper = ({ id, children }: { id: string, children: React.ReactNode }) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("h-full w-full transition-colors", isOver && "bg-muted-teal/10")}>
      {children}
    </div>
  );
};

const SidebarSection = ({ title, items, type, onAdd, onRemove, onUpdate, professors, onRequestAddProfessor, classes, subjects, disabled }: { 
  title: string, 
  items: any[], 
  type: string, 
  onAdd: (name: string, extra?: any) => void,
  onRemove: (id: number) => void,
  onUpdate?: (type: string, id: number, data: any) => void,
  professors?: Professor[],
  onRequestAddProfessor?: (name: string) => void,
  classes?: ClassWithBatches[],
  subjects?: Subject[],
  disabled?: boolean
}) => {
  const [step, setStep] = useState<'none' | 'subject' | 'mode' | 'professor' | 'classes_taught' | 'batch_selection' | 'weightage' | 'generic' | 'room_type' | 'subject_selection'>('none');
  const [formData, setFormData] = useState({ name: '', professorId: '', weightage: 2, allowedClassIds: [] as number[], allowedBatchIds: [] as number[], mode: 'lecture' as 'lecture' | 'lab', roomType: undefined as 'lecture' | 'lab' | undefined, allowedSubjectIds: [] as number[] });
  const [newProfName, setNewProfName] = useState('');

  const handleAdd = () => {
    onAdd(formData.name, { 
      professor_id: formData.professorId ? parseInt(formData.professorId) : undefined, 
      weightage: formData.weightage,
      allowed_class_ids: formData.allowedClassIds,
      allowed_batch_ids: formData.allowedBatchIds,
      mode: formData.mode,
    });
    setStep('none');
    setFormData({ name: '', professorId: '', weightage: 2, allowedClassIds: [], allowedBatchIds: [], mode: 'lecture' });
  };

  const allBatchesOrdered = React.useMemo(() => {
    if (!classes) return [];
    return classes.flatMap(cls => cls.batches);
  }, [classes]);

  return (
    <div className="sidebar-stack">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-steel uppercase tracking-widest">{title}</h3>
        <button disabled={disabled} onClick={() => !disabled && setStep(type === 'subject' ? 'subject' : type === 'classroom' ? 'room_type' : 'generic')} className="p-1 hover:bg-slate-blue rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        {items.map(item => (
          <DraggableItem 
            key={item.id} 
            id={`${type}:${item.id}`} 
            type={type} 
            data={item} 
            onRemove={() => onRemove(item.id)}
            onUpdate={(newData) => { (onUpdate as any)?.(type, item.id, newData); }}
            professors={professors}
            disabled={disabled}
          />
        ))}
      </div>

      {step !== 'none' && type === 'subject' && (
        <div className="p-3 bg-deep-navy rounded-md border border-border-blue-gray space-y-3 shadow-none animate-in fade-in slide-in-from-top-2 duration-200">
          {step === 'subject' && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">Subject Name</label>
              <input 
                autoFocus
                className="w-full text-sm border border-border-blue-gray bg-midnight-blue text-white p-2 rounded focus:outline-none focus:ring-1 focus:ring-muted-teal"
                placeholder="e.g. Mathematics"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && formData.name && setStep('mode')}
              />
              <button 
                disabled={!formData.name}
                onClick={() => setStep('mode')}
                className="w-full mt-2 btn-teal py-1 text-xs"
              >
                Next: Type (Lecture/Lab)
              </button>
            </div>
          )}

          {step === 'mode' && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">Type</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mode: 'lecture' })}
                  className={cn(
                    "flex-1 py-1 text-xs rounded border",
                    formData.mode === 'lecture'
                      ? "border-muted-teal bg-slate-blue text-white"
                      : "border-border-blue-gray bg-midnight-blue text-muted-steel"
                  )}
                >
                  Lecture
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, mode: 'lab' })}
                  className={cn(
                    "flex-1 py-1 text-xs rounded border",
                    formData.mode === 'lab'
                      ? "border-muted-teal bg-slate-blue text-white"
                      : "border-border-blue-gray bg-midnight-blue text-muted-steel"
                  )}
                >
                  Lab
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('subject')} className="flex-1 btn-outline py-1 text-xs">Back</button>
                <button 
                  onClick={() => setStep('professor')}
                  className="flex-1 btn-teal py-1 text-xs"
                >
                  Next: Select Professor
                </button>
              </div>
            </div>
          )}

          {step === 'professor' && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">Select Professor</label>
              <select 
                className="w-full text-sm border border-border-blue-gray bg-midnight-blue text-white p-2 rounded mb-2"
                value={formData.professorId}
                onChange={(e) => setFormData({ ...formData, professorId: e.target.value })}
              >
                <option value="">-- Choose Professor --</option>
                {professors?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="flex gap-2 items-center mb-2">
                <input 
                  className="flex-1 text-xs border border-border-blue-gray bg-midnight-blue text-white p-1 rounded"
                  placeholder="Or add new..."
                  value={newProfName}
                  onChange={(e) => setNewProfName(e.target.value)}
                />
                <button 
                  onClick={() => {
                    if (newProfName && onRequestAddProfessor) {
                      onRequestAddProfessor(newProfName);
                      setNewProfName('');
                    }
                  }}
                  className="p-1 bg-muted-teal text-white rounded"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('subject')} className="flex-1 btn-outline py-1 text-xs">Back</button>
                <button 
                  disabled={!formData.professorId}
                  onClick={() => setStep(formData.mode === 'lecture' ? 'classes_taught' : 'batch_selection')}
                  className="flex-1 btn-teal py-1 text-xs"
                >
                  {formData.mode === 'lecture' ? 'Next: Classes Taught' : 'Next: Batches'}
                </button>
              </div>
            </div>
          )}

          {step === 'classes_taught' && formData.mode === 'lecture' && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">Classes Taught</label>
              <div className="max-h-40 overflow-y-auto space-y-1 mb-3 custom-scrollbar pr-1">
                {classes?.map(cls => (
                  <label key={cls.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-blue rounded cursor-pointer transition-colors">
                    <input 
                      type="checkbox"
                      checked={formData.allowedClassIds.includes(cls.id)}
                      onChange={(e) => {
                        const ids = e.target.checked 
                          ? [...formData.allowedClassIds, cls.id]
                          : formData.allowedClassIds.filter(id => id !== cls.id);
                        setFormData({ ...formData, allowedClassIds: ids });
                      }}
                      className="rounded border-border-blue-gray bg-deep-navy text-muted-teal focus:ring-muted-teal"
                    />
                    <span className="text-xs">{cls.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('professor')} className="flex-1 btn-outline py-1 text-xs">Back</button>
                <button 
                  disabled={formData.allowedClassIds.length === 0}
                  onClick={() => setStep('weightage')}
                  className="flex-1 btn-teal py-1 text-xs"
                >
                  Next: Weightage
                </button>
              </div>
            </div>
          )}

          {step === 'batch_selection' && formData.mode === 'lab' && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">Batches (A1–H3)</label>
              <div className="max-h-40 overflow-y-auto space-y-1 mb-3 custom-scrollbar pr-1">
                {allBatchesOrdered.map(batch => (
                  <label key={batch.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-blue rounded cursor-pointer transition-colors">
                    <input 
                      type="checkbox"
                      checked={formData.allowedBatchIds.includes(batch.id)}
                      onChange={(e) => {
                        const ids = e.target.checked 
                          ? [...formData.allowedBatchIds, batch.id]
                          : formData.allowedBatchIds.filter(id => id !== batch.id);
                        setFormData({ ...formData, allowedBatchIds: ids });
                      }}
                      className="rounded border-border-blue-gray bg-deep-navy text-muted-teal focus:ring-muted-teal"
                    />
                    <span className="text-xs">{batch.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('professor')} className="flex-1 btn-outline py-1 text-xs">Back</button>
                <button 
                  disabled={formData.allowedBatchIds.length === 0}
                  onClick={() => setStep('weightage')}
                  className="flex-1 btn-teal py-1 text-xs"
                >
                  Next: Weightage
                </button>
              </div>
            </div>
          )}

          {step === 'weightage' && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">Weekly Weightage (Hours)</label>
              <div className="flex items-center gap-4 mb-3">
                <button 
                  onClick={() => setFormData({ ...formData, weightage: Math.max(1, formData.weightage - 1) })}
                  className="w-8 h-8 flex items-center justify-center border border-border-blue-gray rounded hover:bg-slate-blue"
                >
                  -
                </button>
                <span className="text-lg font-mono">{formData.weightage}h</span>
                <button 
                  onClick={() => setFormData({ ...formData, weightage: formData.weightage + 1 })}
                  className="w-8 h-8 flex items-center justify-center border border-border-blue-gray rounded hover:bg-slate-blue"
                >
                  +
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(formData.mode === 'lecture' ? 'classes_taught' : 'batch_selection')} className="flex-1 btn-outline py-1 text-xs">Back</button>
                <button onClick={handleAdd} className="flex-1 btn-teal py-1 text-xs">Finish</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step !== 'none' && type === 'classroom' && (
        <div className="p-3 bg-deep-navy rounded-md border border-border-blue-gray space-y-3 shadow-none animate-in fade-in slide-in-from-top-2 duration-200">
          {step === 'room_type' && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">Room type</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, roomType: 'lecture' })}
                  className={cn(
                    "flex-1 py-2 text-xs rounded border",
                    formData.roomType === 'lecture'
                      ? "border-muted-teal bg-slate-blue text-white"
                      : "border-border-blue-gray bg-midnight-blue text-muted-steel"
                  )}
                >
                  Lecture room
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, roomType: 'lab' })}
                  className={cn(
                    "flex-1 py-2 text-xs rounded border",
                    formData.roomType === 'lab'
                      ? "border-muted-teal bg-slate-blue text-white"
                      : "border-border-blue-gray bg-midnight-blue text-muted-steel"
                  )}
                >
                  Lab room
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('none')} className="flex-1 btn-outline py-1 text-xs">Cancel</button>
                <button
                  disabled={!formData.roomType}
                  onClick={() => setStep('subject_selection')}
                  className="flex-1 btn-teal py-1 text-xs"
                >
                  Next: Assign to subjects
                </button>
              </div>
            </div>
          )}
          {step === 'subject_selection' && formData.roomType && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">
                {formData.roomType === 'lecture' ? 'Lecture' : 'Lab'} subjects (optional)
              </label>
              <p className="text-[10px] text-muted-steel mb-2">This room will only be allotted to the selected subjects. Skip to allow all.</p>
              <div className="max-h-40 overflow-y-auto space-y-1 mb-3 custom-scrollbar pr-1 border border-border-blue-gray rounded p-2 bg-midnight-blue">
                {(subjects ?? []).filter(s => (s.mode ?? 'lecture') === formData.roomType).map(sub => (
                  <label key={sub.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-blue rounded cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.allowedSubjectIds.includes(sub.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...formData.allowedSubjectIds, sub.id]
                          : formData.allowedSubjectIds.filter(id => id !== sub.id);
                        setFormData({ ...formData, allowedSubjectIds: ids });
                      }}
                      className="rounded border-border-blue-gray bg-deep-navy text-muted-teal focus:ring-muted-teal"
                    />
                    <span className="text-xs">{sub.name}</span>
                  </label>
                ))}
                {(subjects ?? []).filter(s => (s.mode ?? 'lecture') === formData.roomType).length === 0 && (
                  <span className="text-xs text-muted-steel">No {formData.roomType} subjects yet.</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setStep('room_type')} className="flex-1 btn-outline py-1 text-xs">Back</button>
                <button
                  onClick={() => { setFormData({ ...formData, allowedSubjectIds: [] }); setStep('generic'); }}
                  className="flex-1 btn-outline py-1 text-xs"
                >
                  Skip
                </button>
                <button
                  onClick={() => setStep('generic')}
                  className="flex-1 btn-teal py-1 text-xs"
                >
                  Done → Enter name
                </button>
              </div>
            </div>
          )}
          {step === 'generic' && type === 'classroom' && (
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-steel">Classroom name</label>
              <input
                autoFocus
                className="w-full text-sm border border-border-blue-gray bg-midnight-blue text-white p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-muted-teal mb-2"
                placeholder="e.g. Room 101"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.name.trim()) {
                    onAdd(formData.name.trim(), { room_type: formData.roomType, allowed_subject_ids: formData.allowedSubjectIds.length ? formData.allowedSubjectIds : undefined });
                    setFormData({ ...formData, name: '', roomType: undefined, allowedSubjectIds: [] });
                    setStep('none');
                  }
                  if (e.key === 'Escape') setStep('subject_selection');
                }}
              />
              <div className="flex gap-2">
                <button onClick={() => setStep('subject_selection')} className="flex-1 btn-outline py-1 text-xs">Back</button>
                <button
                  disabled={!formData.name.trim()}
                  onClick={() => {
                    onAdd(formData.name.trim(), { room_type: formData.roomType, allowed_subject_ids: formData.allowedSubjectIds.length ? formData.allowedSubjectIds : undefined });
                    setFormData({ ...formData, name: '', roomType: undefined, allowedSubjectIds: [] });
                    setStep('none');
                  }}
                  className="flex-1 btn-teal py-1 text-xs"
                >
                  Add classroom
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'generic' && type !== 'classroom' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <input 
            autoFocus
            className="w-full text-sm border border-border-blue-gray bg-midnight-blue text-white p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-muted-teal"
            placeholder={`Add ${title.slice(0, -1)}...`}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onAdd(formData.name);
                setFormData({ ...formData, name: '' });
                setStep('none');
              }
              if (e.key === 'Escape') setStep('none');
            }}
            onBlur={() => {
              if (!formData.name) setStep('none');
            }}
          />
        </div>
      )}
    </div>
  );
};

const RollNumberManager = ({
  classes,
  rollRangeByClass,
  rollRangeByBatch,
  rollNumbersByClass,
  rollNumbersByBatch,
  disabled,
  onUpdateBatchRange,
}: {
  classes: ClassWithBatches[];
  rollRangeByClass: Record<number, string>;
  rollRangeByBatch: Record<number, string>;
  rollNumbersByClass: Record<number, string[]>;
  rollNumbersByBatch: Record<number, string[]>;
  disabled?: boolean;
  onUpdateBatchRange: (batchId: number, value: string) => void;
}) => {
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
      {classes.map((cls) => (
        <div key={`class-roll-${cls.id}`} className="border border-border-blue-gray rounded-md p-2 bg-deep-navy/40 space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-muted-steel">{cls.name} (batch-wise list)</label>
          {cls.batches.map((batch) => (
            <div key={`batch-roll-${batch.id}`} className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-steel">{batch.name}</label>
              <input
                value={rollRangeByBatch[batch.id] ?? ''}
                onChange={(e) => onUpdateBatchRange(batch.id, e.target.value)}
                disabled={disabled}
                className="w-full text-xs border border-border-blue-gray bg-midnight-blue text-white p-1.5 rounded"
                placeholder="e.g. 1-20"
              />
              <div className="text-[10px] text-muted-steel">{(rollNumbersByBatch[batch.id] ?? []).length} rolls generated</div>
            </div>
          ))}
          <div className="text-[10px] text-muted-steel">
            Class roll list carried from {cls.batches.map((b) => b.name).join(', ')}: {(rollNumbersByClass[cls.id] ?? []).length} unique rolls
          </div>
        </div>
      ))}
    </div>
  );
};

const DraggableItem = ({ id, type, data, onRemove, onUpdate, professors, disabled }: { id: string, type: string, data: any, onRemove: () => void, onUpdate?: (newData: any) => void, professors?: Professor[], disabled?: boolean, key?: any }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  
  return (
    <div ref={setNodeRef} {...(!disabled ? attributes : {})} {...(!disabled ? listeners : {})} className={cn(isDragging && "opacity-30", disabled && "pointer-events-none opacity-80")}>
      <DraggableChip id={id} type={type} data={data} onRemove={onRemove} onUpdate={onUpdate} professors={professors} />
    </div>
  );
};

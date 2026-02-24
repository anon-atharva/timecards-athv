import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  DragStartEvent, 
  DragEndEvent 
} from '@dnd-kit/core';
import { Plus, X, GripVertical, ChevronDown, AlertCircle, User as UserIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import { 
  User, Year, ClassWithBatches, Professor, Subject, Classroom, 
  TimetableEntry, DAYS, TIME_SLOTS 
} from './types';

const INITIAL_YEAR_NAME = 'Spring 2026';
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
        {type === 'subject' && (
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (onUpdate && data.weightage > 1) onUpdate({ ...data, weightage: data.weightage - 1 });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-5 h-5 flex items-center justify-center rounded bg-deep-navy hover:bg-slate-blue text-[10px] font-bold"
            >
              -
            </button>
            <span className="text-[10px] font-mono w-4 text-center">{data.weightage}h</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (onUpdate) onUpdate({ ...data, weightage: data.weightage + 1 });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-5 h-5 flex items-center justify-center rounded bg-deep-navy hover:bg-slate-blue text-[10px] font-bold"
            >
              +
            </button>
          </div>
        )}
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
  professors: Professor[],
  subjects: Subject[],
  classrooms: Classroom[]
}) => {
  const subject = subjects.find(s => s.id === entry?.subject_id);
  const professor = professors.find(p => p.id === entry?.professor_id);
  const classroom = classrooms.find(c => c.id === entry?.classroom_id);
  const professorColor = professor?.color;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry:${day}:${slotIdx}:${classId}:${batchId}`,
    disabled: !entry,
  });

  return (
    <div className="h-24 border-b border-border-blue-gray last:border-b-0 px-1.5 py-1.5 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {entry ? (
          <motion.div 
            key={`${entry.day}-${entry.time_slot}-${entry.class_id}-${entry.batch_id}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn("w-full h-full", isDragging && "opacity-40")}
            ref={setNodeRef}
            {...attributes}
            {...listeners}
          >
            <div
              className={cn(
                "w-full h-full rounded-md overflow-hidden relative group border border-border-blue-gray px-3 py-2 bg-midnight-blue/90 flex flex-col justify-center cursor-grab active:cursor-grabbing",
                professorColor && "border-l-4",
                // Slight transparency when dragging will be applied via parent using dnd-kit
              )}
              style={{
                ...(professorColor
                  ? {
                      borderLeftColor: professorColor,
                      backgroundColor: hexToRgba(professorColor, entry?.exception_flag ? 0.24 : 0.20),
                    }
                  : {}),
              }}
            >
              <div className="flex flex-col leading-snug pr-6 gap-0.5">
                <span className="font-semibold text-[14px] text-muted-teal truncate">
                  {subject?.name || '---'}
                </span>
                <span className="text-[12px] text-slate-100 truncate">
                  {professor?.name || '—'}
                </span>
                <span className="text-[12px] text-muted-steel truncate">
                  {classroom?.name || '—'}
                </span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-blue rounded absolute right-1 top-1 bg-midnight-blue border border-border-blue-gray shadow-none z-10"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`empty-${day}-${slotIdx}-${classId}-${batchId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          />
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
  const [mondayDate, setMondayDate] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  });

  const getDateForDay = (dayIdx: number) => {
    const date = new Date(mondayDate);
    date.setDate(date.getDate() + dayIdx);
    return date.toLocaleDateString('en-GB'); // dd/mm/yyyy
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (selectedYear) {
      setClasses(allClasses.filter(c => c.year_id === selectedYear.id));
    }
  }, [selectedYear, allClasses]);

  const addEntity = (type: 'professors' | 'subjects' | 'classrooms', name: string, extra?: any) => {
    if (!user) return;
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
        professor_id: extra?.professor_id,
        allowed_class_ids: extra?.allowed_class_ids ?? [],
      };
      setSubjects(prev => [...prev, newSubject]);
    }

    if (type === 'classrooms') {
      const newClassroom: Classroom = { id: classroomIdCounter++, name };
      setClassrooms(prev => [...prev, newClassroom]);
    }
  };

  const requestAddProfessor = (name: string) => {
    if (!name.trim()) return;
    setPendingProfessorName(name.trim());
  };

  const finalizeAddProfessor = (color: string) => {
    if (!pendingProfessorName) return;
    addEntity('professors', pendingProfessorName, { color });
    setPendingProfessorName(null);
  };

  const removeEntity = (type: 'professors' | 'subjects' | 'classrooms', id: number) => {
    if (!user) return;
    if (type === 'professors') setProfessors(prev => prev.filter(p => p.id !== id));
    if (type === 'subjects') setSubjects(prev => prev.filter(s => s.id !== id));
    if (type === 'classrooms') setClassrooms(prev => prev.filter(c => c.id !== id));
  };

  const onDragStart = (event: DragStartEvent) => {
    if (!user) return;
    const { active } = event;
    const [type, ...rest] = (active.id as string).split(':');

    if (type === 'entry') {
      const [dayStr, slotStr, classStr, batchStr] = rest;
      const origin = timetable.find(t =>
        t.day === parseInt(dayStr) &&
        t.time_slot === parseInt(slotStr) &&
        t.class_id === parseInt(classStr) &&
        t.batch_id === parseInt(batchStr)
      );
      if (origin) {
        const subj = subjects.find(s => s.id === origin.subject_id);
        setActiveDrag({
          id: active.id as string,
          type,
          data: { name: subj?.name ?? '' },
        });
      }
      return;
    }

    const id = rest[0];
    let data;
    if (type === 'professor') data = professors.find(p => p.id === parseInt(id));
    if (type === 'subject') data = subjects.find(s => s.id === parseInt(id));
    if (type === 'classroom') data = classrooms.find(c => c.id === parseInt(id));
    setActiveDrag({ id: active.id as string, type, data });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveDrag(null);
    if (!over || !user) return;

    const [type, ...rest] = (active.id as string).split(':');
    const [targetType, day, slot, classId, batchId] = (over.id as string).split(':');

    if (targetType === 'cell') {
      if (type === 'entry') {
        const [srcDay, srcSlot, srcClass, srcBatch] = rest;
        const origin = timetable.find(t =>
          t.day === parseInt(srcDay) &&
          t.time_slot === parseInt(srcSlot) &&
          t.class_id === parseInt(srcClass) &&
          t.batch_id === parseInt(srcBatch)
        );
        if (!origin) return;

        const update = {
          day: parseInt(day),
          time_slot: parseInt(slot),
          class_id: parseInt(classId),
          batch_id: parseInt(batchId),
          subject_id: origin.subject_id,
          professor_id: origin.professor_id,
          classroom_id: origin.classroom_id,
          exception_flag: origin.exception_flag,
        };

        saveEntry(update);
        clearCell(origin.day, origin.time_slot, origin.class_id, origin.batch_id);
        return;
      }

      const entityId = rest[0];
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
    if (!user) return;
    setTimetable(prev =>
      prev.filter(t =>
        !(t.day === day && t.time_slot === slot && t.class_id === classId && t.batch_id === batchId)
      )
    );
  };

  const updateEntity = (type: 'subjects', id: number, data: any) => {
    if (!user) return;
    if (type === 'subjects') {
      setSubjects(prev => prev.map(s => (s.id === id ? { ...s, ...data } : s)));
    }
  };

  const autoCreate = () => {
    if (!user) return;
    if (subjects.length === 0) {
      alert("Please add some subjects first.");
      return;
    }

    const newEntries: TimetableEntry[] = [];
    const profSchedule: Record<string, boolean> = {}; // "day:slot:profId"
    const roomSchedule: Record<string, boolean> = {}; // "day:slot:roomId"

    // For each class and its batches
    for (const cls of classes) {
      for (const batch of cls.batches) {
        let availableSlots: { day: number, slot: number }[] = [];
        for (let d = 0; d < 5; d++) {
          for (let s = 0; s < 8; s++) {
            availableSlots.push({ day: d, slot: s });
          }
        }
        // Shuffle slots
        availableSlots.sort(() => Math.random() - 0.5);

        for (const sub of subjects) {
          // Respect allowed classes
          if (sub.allowed_class_ids && sub.allowed_class_ids.length > 0 && !sub.allowed_class_ids.includes(cls.id)) {
            continue;
          }

          // Respect weightage
          for (let h = 0; h < sub.weightage; h++) {
            if (availableSlots.length === 0) break;

            let found = false;
            let attempts = 0;

            while (!found && attempts < availableSlots.length) {
              const { day, slot } = availableSlots[0]; // Always try the first available slot
              
              // Use assigned professor if available, otherwise pick random
              const profId = sub.professor_id || (professors[Math.floor(Math.random() * professors.length)]?.id);
              const room = classrooms[Math.floor(Math.random() * classrooms.length)];
              
              const profKey = `${day}:${slot}:${profId}`;
              const roomKey = `${day}:${slot}:${room?.id}`;

              const profBusy = profId && profSchedule[profKey];
              const roomBusy = room && roomSchedule[roomKey];

              if (!profBusy && !roomBusy) {
                const entry: TimetableEntry = {
                  id: timetableEntryIdCounter++,
                  day,
                  time_slot: slot,
                  class_id: cls.id,
                  batch_id: batch.id,
                  subject_id: sub.id,
                  professor_id: profId || null,
                  classroom_id: room?.id || null,
                  exception_flag: false
                };
                newEntries.push(entry);
                if (profId) profSchedule[profKey] = true;
                if (room) roomSchedule[roomKey] = true;
                found = true;
                availableSlots.shift(); // Remove this slot from available for THIS batch
              } else {
                // Move the slot to the end and try the next one
                availableSlots.push(availableSlots.shift()!);
                attempts++;
              }
            }
          }
        }
      }
    }

    setTimetable(newEntries);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="min-h-screen flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-midnight-blue border-b border-border-blue-gray px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-serif font-bold text-muted-teal tracking-tight">TIMECARDS</h1>
            <div className="relative group">
              <button className="flex items-center gap-2 text-sm font-medium hover:text-muted-teal transition-colors">
                {selectedYear?.name} <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 mt-1 bg-midnight-blue border border-border-blue-gray shadow-none rounded-md py-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {years.map(y => (
                  <button 
                    key={y.id} 
                    onClick={() => setSelectedYear(y)}
                    className={cn("w-full text-left px-4 py-2 text-sm hover:bg-slate-blue", selectedYear?.id === y.id && "bg-slate-blue font-semibold")}
                  >
                    Year {y.name}
                  </button>
                ))}
                <div className="border-t border-border-blue-gray mt-2 pt-2">
                  <button 
                    onClick={() => setIsProfessorModalOpen(true)}
                    className="w-full text-left px-4 py-2 text-sm text-muted-teal flex items-center gap-2"
                  >
                    <UserIcon className="w-4 h-4" /> Manage Professors
                  </button>
                  <button 
                    onClick={async () => {
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
                    className="w-full text-left px-4 py-2 text-sm text-muted-teal flex items-center gap-2"
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
                onChange={(e) => setMondayDate(e.target.value)}
                className="bg-deep-navy border border-border-blue-gray text-[10px] text-white p-1 rounded focus:outline-none focus:ring-1 focus:ring-muted-teal"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          {/* Timetable Grid */}
          <div className="flex-1 overflow-auto p-8 bg-deep-navy">
            <div className="max-w-7xl mx-auto">
              {/* Day Tabs */}
              <div className="flex gap-1 mb-8">
                {DAYS.map((day, idx) => (
                  <button
                    key={day}
                    onClick={() => setActiveDay(idx)}
                    className={cn(
                      "px-6 py-2 text-sm font-medium rounded-t-md transition-all border-b-2",
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
          <aside className="w-80 border-l border-border-blue-gray bg-midnight-blue p-6 overflow-y-auto flex flex-col">
            <div className="mb-8 pb-8 border-b border-border-blue-gray space-y-3">
              <button 
                onClick={autoCreate}
                className="w-full btn-teal py-4 flex items-center justify-center gap-2 shadow-none"
              >
                AUTO-CREATE TIMETABLE
              </button>
              <p className="text-[10px] text-muted-steel mt-2 text-center uppercase tracking-widest">
                Based on subject weightage
              </p>
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
              />
              <div className="border-t border-border-blue-gray my-8" />
              <SidebarSection 
                title="Classrooms" 
                items={classrooms} 
                type="classroom" 
                onAdd={(name) => addEntity('classrooms', name)}
                onRemove={(id) => removeEntity('classrooms', id)}
              />
            </div>
          </aside>
        </main>

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

                <div className="grid grid-cols-5 gap-3 mb-6">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => finalizeAddProfessor(c)}
                      className="h-10 rounded-md border border-border-blue-gray hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-muted-teal"
                      style={{ backgroundColor: c }}
                      aria-label={`Select color ${c}`}
                      title={c}
                    />
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingProfessorName(null)}
                    className="flex-1 btn-outline"
                  >
                    Cancel
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

const SidebarSection = ({ title, items, type, onAdd, onRemove, onUpdate, professors, onRequestAddProfessor, classes }: { 
  title: string, 
  items: any[], 
  type: string, 
  onAdd: (name: string, extra?: any) => void,
  onRemove: (id: number) => void,
  onUpdate?: (type: string, id: number, data: any) => void,
  professors?: Professor[],
  onRequestAddProfessor?: (name: string) => void,
  classes?: ClassWithBatches[]
}) => {
  const [step, setStep] = useState<'none' | 'subject' | 'professor' | 'classes_taught' | 'weightage' | 'generic'>('none');
  const [formData, setFormData] = useState({ name: '', professorId: '', weightage: 2, allowedClassIds: [] as number[] });
  const [newProfName, setNewProfName] = useState('');

  const handleAdd = () => {
    onAdd(formData.name, { 
      professor_id: formData.professorId ? parseInt(formData.professorId) : undefined, 
      weightage: formData.weightage,
      allowed_class_ids: formData.allowedClassIds
    });
    setStep('none');
    setFormData({ name: '', professorId: '', weightage: 2, allowedClassIds: [] });
  };

  return (
    <div className="sidebar-stack">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-steel uppercase tracking-widest">{title}</h3>
        <button onClick={() => setStep(type === 'subject' ? 'subject' : 'generic')} className="p-1 hover:bg-slate-blue rounded transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-2 mb-4">
        {items.map(item => (
          <DraggableItem 
            key={item.id} 
            id={`${type}:${item.id}`} 
            type={type} 
            data={item} 
            onRemove={() => onRemove(item.id)}
            onUpdate={(newData) => { (onUpdate as any)?.(type, item.id, newData); }}
            professors={professors}
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
                onKeyDown={(e) => e.key === 'Enter' && formData.name && setStep('professor')}
              />
              <button 
                disabled={!formData.name}
                onClick={() => setStep('professor')}
                className="w-full mt-2 btn-teal py-1 text-xs"
              >
                Next: Select Professor
              </button>
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
                  onClick={() => setStep('classes_taught')}
                  className="flex-1 btn-teal py-1 text-xs"
                >
                  Next: Classes Taught
                </button>
              </div>
            </div>
          )}

          {step === 'classes_taught' && (
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
                <button onClick={() => setStep('classes_taught')} className="flex-1 btn-outline py-1 text-xs">Back</button>
                <button onClick={handleAdd} className="flex-1 btn-teal py-1 text-xs">Finish</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'generic' && (
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

const DraggableItem = ({ id, type, data, onRemove, onUpdate, professors }: { id: string, type: string, data: any, onRemove: () => void, onUpdate?: (newData: any) => void, professors?: Professor[], key?: any }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-30")}>
      <DraggableChip id={id} type={type} data={data} onRemove={onRemove} onUpdate={onUpdate} professors={professors} />
    </div>
  );
};

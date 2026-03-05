import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface User {
  id: string;
  name: string;
}

export interface Year {
  id: number;
  name: string;
}

export interface Batch {
  id: number;
  class_id: number;
  name: string;
}

export interface ClassWithBatches {
  id: number;
  year_id: number;
  name: string;
  batches: Batch[];
}

export interface Professor {
  id: number;
  name: string;
  color: string;
}

export interface Subject {
  id: number;
  name: string;
  weightage: number;
  mode?: 'lecture' | 'lab';
  professor_id?: number;
  allowed_class_ids?: number[];
  allowed_batch_ids?: number[];
}

export interface Classroom {
  id: number;
  name: string;
  /** 'lecture' = only for lecture subjects; 'lab' = only for lab subjects */
  room_type?: 'lecture' | 'lab';
  /** If set, this room is only allotted to these subject IDs. Empty/undefined = all subjects of room_type */
  allowed_subject_ids?: number[];
}

export interface TimetableEntry {
  id: number;
  day: number;
  time_slot: number;
  class_id: number;
  batch_id: number;
  subject_id: number | null;
  professor_id: number | null;
  classroom_id: number | null;
  exception_flag: boolean;
}

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const TIME_SLOTS = [
  "9–10", "10–11", "11–12", "12–1", "1–2", "2–3", "3–4", "4–5"
];

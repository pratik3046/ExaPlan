export interface Student {
  id: number;
  roll_number: string;
  name: string;
  branch: string;
  semester: number;
  is_backlog: boolean;
}

export interface Room {
  id: number;
  room_number: string;
  block?: string;
  floor?: number;
  rows: number;
  columns: number;
  bench_count: number;
  exam_capacity: number;
  total_physical_capacity: number;
}

export interface Faculty {
  id: number;
  faculty_id: string;
  name: string;
  department: string;
  rank: "Senior" | "Junior";
  cumulative_duties: number;
  is_available: boolean;
}

export interface ExamSession {
  id: number;
  name: string;
  exam_date: string;
  shift: string;
  exam_type: "Midterm" | "Endterm";
  is_active: boolean;
}

export interface BranchSummary {
  branch: string;
  student_count: number;
  min_roll: string;
  max_roll: string;
}

export interface SeatItem {
  allocation_id: number;
  seat_position: "LEFT" | "RIGHT" | "SINGLE";
  student_id: number;
  roll_number: string;
  name: string;
  branch: string;
  semester: number;
  is_backlog: boolean;
}

export interface BenchItem {
  bench_id: number;
  bench_number: number;
  row: number;
  col: number;
  seats: SeatItem[];
}

export interface RoomMatrixData {
  session_id: number;
  session_name: string;
  exam_type: string;
  room_id: number;
  room_number: string;
  rows: number;
  columns: number;
  invigilators: Array<{
    faculty_id: number;
    faculty_code: string;
    name: string;
    rank: string;
    duty_role: string;
  }>;
  benches: BenchItem[];
}

export interface AuditLogItem {
  id: number;
  action: string;
  details: string;
  timestamp: string;
}

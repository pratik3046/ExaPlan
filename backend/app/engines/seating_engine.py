import re
from typing import List, Tuple, Optional
from collections import deque
from sqlalchemy.orm import Session
from sqlalchemy import asc
from app.database import models
from app.schemas.engine import (
    SeatingGenerationRequest,
    SeatingGenerationResponse,
    SeatAllocationItem,
    SeatingMode,
    SwapValidationRequest,
    SwapValidationResponse,
)

def extract_roll_number_tuple(roll_str: str) -> Tuple[str, int, str]:
    """
    Parses a roll number into (prefix, numeric_part, suffix) for natural ordering and range filtering.
    e.g. 'CSE-045' -> ('CSE-', 45, '')
    """
    cleaned = roll_str.strip().upper()
    match = re.search(r"^(.*?)(\d+)(.*?)$", cleaned)
    if match:
        prefix, num, suffix = match.groups()
        return (prefix, int(num), suffix)
    return (cleaned, 0, "")

def is_roll_in_range(roll: str, start_roll: str, end_roll: str) -> bool:
    """
    Checks if roll falls inclusive between start_roll and end_roll.
    Accounts for alphanumeric roll numbers with integer suffixes.
    """
    roll_tup = extract_roll_number_tuple(roll)
    start_tup = extract_roll_number_tuple(start_roll)
    end_tup = extract_roll_number_tuple(end_roll)

    # If same prefix pattern, compare numeric parts
    if roll_tup[0] == start_tup[0] == end_tup[0] and (start_tup[1] > 0 or end_tup[1] > 0):
        min_val = min(start_tup[1], end_tup[1])
        max_val = max(start_tup[1], end_tup[1])
        return min_val <= roll_tup[1] <= max_val and roll_tup[2] == start_tup[2]

    # Fallback standard string comparison
    s_min = min(start_roll.strip().upper(), end_roll.strip().upper())
    s_max = max(start_roll.strip().upper(), end_roll.strip().upper())
    return s_min <= roll.strip().upper() <= s_max

class SeatingEngine:
    def __init__(self, db: Session):
        self.db = db

    def generate_seating(self, req: SeatingGenerationRequest) -> SeatingGenerationResponse:
        warnings: List[str] = []

        # 1. Fetch Session and Room
        session = self.db.query(models.ExamSession).filter(models.ExamSession.id == req.session_id).first()
        if not session:
            raise ValueError(f"Exam Session ID {req.session_id} not found.")

        room = self.db.query(models.Room).filter(models.Room.id == req.room_id).first()
        if not room:
            raise ValueError(f"Room ID {req.room_id} not found.")

        # 2. Check Exam Type capacity restrictions (PRD Section 3.2)
        # Endterm: 50% capacity lock, mandatory 1 student per bench (no paired sharing)
        is_endterm = session.exam_type.upper() == models.ExamType.ENDTERM.value.upper()
        effective_seating_mode = SeatingMode.SINGLE if is_endterm else req.seating_mode

        if is_endterm and req.seating_mode == SeatingMode.PAIRED:
            warnings.append("Endterm exam type enforces a 50% capacity lock. Switched to single occupant per bench.")

        # 3. Query Benches
        benches = (
            self.db.query(models.RoomBench)
            .filter(models.RoomBench.room_id == req.room_id, models.RoomBench.is_active == True)
            .order_by(asc(models.RoomBench.row), asc(models.RoomBench.col), asc(models.RoomBench.bench_number))
            .all()
        )

        if not benches:
            raise ValueError(f"Room {room.room_number} has no active benches configured.")

        # 4. Fetch valid students for Branch A and Branch B using Detached Queues
        # Query existing students from DB for Branch A
        students_a_raw = (
            self.db.query(models.Student)
            .filter(models.Student.branch == req.branch_a.branch.strip().upper())
            .all()
        )
        # Sort naturally
        students_a_sorted = sorted(students_a_raw, key=lambda s: extract_roll_number_tuple(s.roll_number))
        # Filter strictly within roll number range
        students_a = [
            s for s in students_a_sorted
            if is_roll_in_range(s.roll_number, req.branch_a.start_roll, req.branch_a.end_roll)
        ]
        queue_a = deque(students_a)

        queue_b = deque()
        if req.branch_b and req.branch_b.branch:
            students_b_raw = (
                self.db.query(models.Student)
                .filter(models.Student.branch == req.branch_b.branch.strip().upper())
                .all()
            )
            students_b_sorted = sorted(students_b_raw, key=lambda s: extract_roll_number_tuple(s.roll_number))
            students_b = [
                s for s in students_b_sorted
                if is_roll_in_range(s.roll_number, req.branch_b.start_roll, req.branch_b.end_roll)
            ]
            queue_b = deque(students_b)

        # 5. Clear any prior allocations for this room in this session
        self.db.query(models.SeatingAllocation).filter(
            models.SeatingAllocation.session_id == req.session_id,
            models.SeatingAllocation.room_id == req.room_id,
        ).delete(synchronize_session=False)
        self.db.commit()

        # 6. Allocation Loop: Map students to benches sequentially
        # Skipping missing roll numbers dynamically because queues only hold valid students!
        allocations_to_create: List[models.SeatingAllocation] = []
        result_items: List[SeatAllocationItem] = []

        total_benches = len(benches)

        for bench in benches:
            if not queue_a and not queue_b:
                break  # All queued students seated

            if effective_seating_mode == SeatingMode.SINGLE:
                # Single Seating: 1 student per bench (prefer alternating queues if both provided)
                student = None
                if queue_a:
                    student = queue_a.popleft()
                elif queue_b:
                    student = queue_b.popleft()

                if student:
                    alloc = models.SeatingAllocation(
                        session_id=session.id,
                        room_id=room.id,
                        bench_id=bench.id,
                        seat_position=models.SeatPosition.SINGLE.value,
                        student_id=student.id,
                    )
                    allocations_to_create.append(alloc)
                    result_items.append(
                        SeatAllocationItem(
                            bench_id=bench.id,
                            bench_number=bench.bench_number,
                            row=bench.row,
                            col=bench.col,
                            seat_position=models.SeatPosition.SINGLE.value,
                            student_id=student.id,
                            roll_number=student.roll_number,
                            name=student.name,
                            branch=student.branch,
                        )
                    )

            else:
                # PAIRED Seating: 2 students per bench with STRICT Branch Isolation
                # Left Seat: Branch A; Right Seat: Branch B
                student_left = queue_a.popleft() if queue_a else None
                student_right = queue_b.popleft() if queue_b else None

                # Enforce rule: Strictly prevent two students of the same branch from sharing the same bench!
                # If one queue is empty, do NOT place student from same branch on the other side!
                if student_left:
                    alloc_left = models.SeatingAllocation(
                        session_id=session.id,
                        room_id=room.id,
                        bench_id=bench.id,
                        seat_position=models.SeatPosition.LEFT.value,
                        student_id=student_left.id,
                    )
                    allocations_to_create.append(alloc_left)
                    result_items.append(
                        SeatAllocationItem(
                            bench_id=bench.id,
                            bench_number=bench.bench_number,
                            row=bench.row,
                            col=bench.col,
                            seat_position=models.SeatPosition.LEFT.value,
                            student_id=student_left.id,
                            roll_number=student_left.roll_number,
                            name=student_left.name,
                            branch=student_left.branch,
                        )
                    )

                if student_right:
                    alloc_right = models.SeatingAllocation(
                        session_id=session.id,
                        room_id=room.id,
                        bench_id=bench.id,
                        seat_position=models.SeatPosition.RIGHT.value,
                        student_id=student_right.id,
                    )
                    allocations_to_create.append(alloc_right)
                    result_items.append(
                        SeatAllocationItem(
                            bench_id=bench.id,
                            bench_number=bench.bench_number,
                            row=bench.row,
                            col=bench.col,
                            seat_position=models.SeatPosition.RIGHT.value,
                            student_id=student_right.id,
                            roll_number=student_right.roll_number,
                            name=student_right.name,
                            branch=student_right.branch,
                        )
                    )

        # 7. Check for unseated students (room capacity overflow)
        unallocated_a = len(queue_a)
        unallocated_b = len(queue_b)
        if unallocated_a > 0:
            warnings.append(f"{unallocated_a} student(s) from Branch A could not fit in Room {room.room_number}.")
        if unallocated_b > 0:
            warnings.append(f"{unallocated_b} student(s) from Branch B could not fit in Room {room.room_number}.")

        # 8. Persist to DB
        self.db.bulk_save_objects(allocations_to_create)
        self.db.commit()

        return SeatingGenerationResponse(
            session_id=session.id,
            room_id=room.id,
            room_number=room.room_number,
            seating_mode=effective_seating_mode.value,
            exam_type=session.exam_type,
            total_allocated=len(allocations_to_create),
            unallocated_count_branch_a=unallocated_a,
            unallocated_count_branch_b=unallocated_b,
            allocations=result_items,
            warnings=warnings,
        )

    def validate_and_swap(self, req: SwapValidationRequest) -> SwapValidationResponse:
        """
        Validates whether two seat allocations can be swapped without violating:
        1. Double-booking
        2. Branch isolation on paired benches (no two students of same branch on same bench)
        """
        alloc1 = self.db.query(models.SeatingAllocation).filter(
            models.SeatingAllocation.id == req.allocation_id_1,
            models.SeatingAllocation.session_id == req.session_id
        ).first()

        alloc2 = self.db.query(models.SeatingAllocation).filter(
            models.SeatingAllocation.id == req.allocation_id_2,
            models.SeatingAllocation.session_id == req.session_id
        ).first()

        if not alloc1 or not alloc2:
            return SwapValidationResponse(valid=False, reason="One or both allocations do not exist.")

        if alloc1.bench_id != alloc2.bench_id:
            # Check bench mate of alloc1's bench
            other_seat_on_bench_1 = self.db.query(models.SeatingAllocation).filter(
                models.SeatingAllocation.session_id == req.session_id,
                models.SeatingAllocation.bench_id == alloc1.bench_id,
                models.SeatingAllocation.id != alloc1.id
            ).first()

            # Check bench mate of alloc2's bench
            other_seat_on_bench_2 = self.db.query(models.SeatingAllocation).filter(
                models.SeatingAllocation.session_id == req.session_id,
                models.SeatingAllocation.bench_id == alloc2.bench_id,
                models.SeatingAllocation.id != alloc2.id
            ).first()

            student1 = alloc1.student
            student2 = alloc2.student

            # Check if student2 moving to bench1 violates branch isolation
            if other_seat_on_bench_1 and other_seat_on_bench_1.student.branch == student2.branch:
                return SwapValidationResponse(
                    valid=False,
                    reason=f"Constraint violation: Student {student2.roll_number} ({student2.branch}) would share bench with same branch ({other_seat_on_bench_1.student.branch})."
                )

            # Check if student1 moving to bench2 violates branch isolation
            if other_seat_on_bench_2 and other_seat_on_bench_2.student.branch == student1.branch:
                return SwapValidationResponse(
                    valid=False,
                    reason=f"Constraint violation: Student {student1.roll_number} ({student1.branch}) would share bench with same branch ({other_seat_on_bench_2.student.branch})."
                )

        # Perform swap by capturing state, removing old records, and re-inserting swapped allocations
        # This completely avoids intermediate UNIQUE constraint collisions on both student_id and seat_position
        s1_id, r1_id, b1_id, p1 = alloc1.session_id, alloc1.room_id, alloc1.bench_id, alloc1.seat_position
        s2_id, r2_id, b2_id, p2 = alloc2.session_id, alloc2.room_id, alloc2.bench_id, alloc2.seat_position
        student1_id, student2_id = alloc1.student_id, alloc2.student_id
        room_number = alloc1.room.room_number
        b1_num = alloc1.bench.bench_number
        b2_num = alloc2.bench.bench_number
        s1_roll = alloc1.student.roll_number
        s2_roll = alloc2.student.roll_number

        self.db.delete(alloc1)
        self.db.delete(alloc2)
        self.db.flush()

        new_alloc1 = models.SeatingAllocation(
            session_id=s1_id,
            room_id=r1_id,
            bench_id=b1_id,
            seat_position=p1,
            student_id=student2_id,
        )
        new_alloc2 = models.SeatingAllocation(
            session_id=s2_id,
            room_id=r2_id,
            bench_id=b2_id,
            seat_position=p2,
            student_id=student1_id,
        )
        self.db.add_all([new_alloc1, new_alloc2])

        # Log audit trail (PRD Section 3.5 & Security Spec Section 4)
        audit_entry = models.AuditLog(
            action="SWAP_SEATS",
            details=f"Swapped Student {s1_roll} (Bench {b1_num}) with Student {s2_roll} (Bench {b2_num}) in Room {room_number}"
        )
        self.db.add(audit_entry)
        self.db.commit()

        return SwapValidationResponse(valid=True, reason="Swap validated and executed successfully.")

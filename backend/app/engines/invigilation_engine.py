from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import asc
from app.database import models
from app.schemas.engine import (
    InvigilationGenerationRequest,
    InvigilationGenerationResponse,
    InvigilationAllocationItem,
)

class InvigilationEngine:
    def __init__(self, db: Session):
        self.db = db

    def generate_invigilation(self, req: InvigilationGenerationRequest) -> InvigilationGenerationResponse:
        warnings: List[str] = []

        # 1. Fetch Session
        session = self.db.query(models.ExamSession).filter(models.ExamSession.id == req.session_id).first()
        if not session:
            raise ValueError(f"Exam Session ID {req.session_id} not found.")

        # 2. Fetch Rooms
        rooms = (
            self.db.query(models.Room)
            .filter(models.Room.id.in_(req.room_ids))
            .all()
        )
        if not rooms:
            raise ValueError("No matching rooms found for the provided room IDs.")

        is_endterm = session.exam_type.upper() == models.ExamType.ENDTERM.value.upper()

        # 3. Clear existing allocations for this session and these rooms
        self.db.query(models.InvigilationAllocation).filter(
            models.InvigilationAllocation.session_id == session.id,
            models.InvigilationAllocation.room_id.in_(req.room_ids),
        ).delete(synchronize_session=False)
        self.db.commit()

        # 4. Find all faculty already assigned to other rooms in this same session
        concurrently_assigned_ids = [
            row[0] for row in self.db.query(models.InvigilationAllocation.faculty_id)
            .filter(models.InvigilationAllocation.session_id == session.id)
            .all()
        ]

        # 5. Find faculty on leave on the session date
        leave_faculty_ids = [
            row[0] for row in self.db.query(models.FacultyLeave.faculty_id)
            .filter(
                (models.FacultyLeave.session_id == session.id) |
                (models.FacultyLeave.date == session.exam_date)
            )
            .all()
        ]

        disqualified_ids = set(concurrently_assigned_ids + leave_faculty_ids)

        # 6. Fetch Available Faculty sorted by cumulative_duties ASC (Workload Balancing)
        base_query = (
            self.db.query(models.Faculty)
            .filter(
                models.Faculty.is_available == True,
                ~models.Faculty.id.in_(disqualified_ids) if disqualified_ids else True
            )
            .order_by(asc(models.Faculty.cumulative_duties), asc(models.Faculty.id))
        )

        all_available_faculty = base_query.all()

        allocations_to_create: List[models.InvigilationAllocation] = []
        result_items: List[InvigilationAllocationItem] = []
        assigned_in_this_run = set()

        if is_endterm:
            # Endterm Rule: Hierarchical Pairing (1 Senior + 1 Junior per room)
            senior_pool = [f for f in all_available_faculty if f.rank.upper() == models.FacultyRank.SENIOR.value.upper()]
            junior_pool = [f for f in all_available_faculty if f.rank.upper() == models.FacultyRank.JUNIOR.value.upper()]

            for room in rooms:
                # Find available senior
                senior = next((f for f in senior_pool if f.id not in assigned_in_this_run), None)
                # Find available junior
                junior = next((f for f in junior_pool if f.id not in assigned_in_this_run), None)

                if not senior:
                    warnings.append(f"Endterm requires 1 Senior Faculty: None available for Room {room.room_number}.")
                if not junior:
                    warnings.append(f"Endterm requires 1 Junior Faculty: None available for Room {room.room_number}.")

                if senior:
                    assigned_in_this_run.add(senior.id)
                    alloc_senior = models.InvigilationAllocation(
                        session_id=session.id,
                        room_id=room.id,
                        faculty_id=senior.id,
                        duty_role="Senior Invigilator"
                    )
                    allocations_to_create.append(alloc_senior)
                    senior.cumulative_duties += 1
                    result_items.append(
                        InvigilationAllocationItem(
                            room_id=room.id,
                            room_number=room.room_number,
                            faculty_id=senior.id,
                            faculty_code=senior.faculty_id,
                            faculty_name=senior.name,
                            rank=senior.rank,
                            duty_role="Senior Invigilator",
                            current_duties=senior.cumulative_duties,
                        )
                    )

                if junior:
                    assigned_in_this_run.add(junior.id)
                    alloc_junior = models.InvigilationAllocation(
                        session_id=session.id,
                        room_id=room.id,
                        faculty_id=junior.id,
                        duty_role="Junior Invigilator"
                    )
                    allocations_to_create.append(alloc_junior)
                    junior.cumulative_duties += 1
                    result_items.append(
                        InvigilationAllocationItem(
                            room_id=room.id,
                            room_number=room.room_number,
                            faculty_id=junior.id,
                            faculty_code=junior.faculty_id,
                            faculty_name=junior.name,
                            rank=junior.rank,
                            duty_role="Junior Invigilator",
                            current_duties=junior.cumulative_duties,
                        )
                    )
        else:
            # Midterm Rule: 1 faculty per room, lowest duty count
            for room in rooms:
                invigilator = next((f for f in all_available_faculty if f.id not in assigned_in_this_run), None)
                if not invigilator:
                    warnings.append(f"Insufficient faculty: No invigilator available for Room {room.room_number}.")
                    continue

                assigned_in_this_run.add(invigilator.id)
                alloc = models.InvigilationAllocation(
                    session_id=session.id,
                    room_id=room.id,
                    faculty_id=invigilator.id,
                    duty_role="Sole Invigilator"
                )
                allocations_to_create.append(alloc)
                invigilator.cumulative_duties += 1
                result_items.append(
                    InvigilationAllocationItem(
                        room_id=room.id,
                        room_number=room.room_number,
                        faculty_id=invigilator.id,
                        faculty_code=invigilator.faculty_id,
                        faculty_name=invigilator.name,
                        rank=invigilator.rank,
                        duty_role="Sole Invigilator",
                        current_duties=invigilator.cumulative_duties,
                    )
                )

        # 7. Persist
        self.db.bulk_save_objects(allocations_to_create)
        self.db.commit()

        return InvigilationGenerationResponse(
            session_id=session.id,
            exam_type=session.exam_type,
            total_rooms=len(rooms),
            allocations=result_items,
            warnings=warnings,
        )

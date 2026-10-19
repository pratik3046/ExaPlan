from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database import models

router = APIRouter(tags=["Student & Faculty Lookup Portals"])

@router.get("/student/lookup/{roll_number}")
def student_lookup(roll_number: str, db: Session = Depends(get_db)):
    """
    Public / Student mobile-first read-only lookup:
    Returns student profile and their scheduled seating allocations (Date, Shift, Room, Bench, Seat Position).
    """
    cleaned_roll = roll_number.strip().upper()
    student = db.query(models.Student).filter(models.Student.roll_number == cleaned_roll).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with roll number '{cleaned_roll}' not found.",
        )

    allocations = (
        db.query(models.SeatingAllocation)
        .filter(models.SeatingAllocation.student_id == student.id)
        .all()
    )

    schedules = []
    for a in allocations:
        schedules.append({
            "session_id": a.session.id,
            "session_name": a.session.name,
            "exam_date": a.session.exam_date,
            "shift": a.session.shift,
            "exam_type": a.session.exam_type,
            "room_number": a.room.room_number,
            "block": a.room.block,
            "floor": a.room.floor,
            "bench_number": a.bench.bench_number,
            "seat_position": a.seat_position,
        })

    return {
        "student": {
            "roll_number": student.roll_number,
            "name": student.name,
            "branch": student.branch,
            "semester": student.semester,
            "is_backlog": student.is_backlog,
        },
        "schedules": schedules,
    }

@router.get("/faculty/schedule/{faculty_id}")
def faculty_schedule(faculty_id: str, db: Session = Depends(get_db)):
    """
    Faculty read-only portal:
    Returns faculty member details and their scheduled invigilation duties.
    """
    cleaned_id = faculty_id.strip().upper()
    faculty = db.query(models.Faculty).filter(models.Faculty.faculty_id == cleaned_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty member with ID '{cleaned_id}' not found.",
        )

    allocations = (
        db.query(models.InvigilationAllocation)
        .filter(models.InvigilationAllocation.faculty_id == faculty.id)
        .all()
    )

    duties = []
    for a in allocations:
        duties.append({
            "session_id": a.session.id,
            "session_name": a.session.name,
            "exam_date": a.session.exam_date,
            "shift": a.session.shift,
            "exam_type": a.session.exam_type,
            "room_number": a.room.room_number,
            "duty_role": a.duty_role,
        })

    return {
        "faculty": {
            "faculty_id": faculty.faculty_id,
            "name": faculty.name,
            "department": faculty.department,
            "rank": faculty.rank,
            "cumulative_duties": faculty.cumulative_duties,
        },
        "duties": duties,
    }

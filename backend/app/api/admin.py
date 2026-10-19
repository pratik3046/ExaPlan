from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from app.database.session import get_db
from app.database import models
from app.core.deps import require_admin_or_coordinator
from app.services.csv_service import (
    import_students_from_file,
    import_faculty_from_file,
    import_rooms_from_file,
)

router = APIRouter(prefix="/admin", tags=["Admin & Data Management"])

class SessionCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    exam_date: str = Field(..., min_length=1, max_length=50)
    shift: str = Field(..., min_length=1, max_length=50)
    exam_type: str = Field(..., pattern="^(Midterm|Endterm)$")

@router.post("/upload-students")
async def upload_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    try:
        content = await file.read()
        res = import_students_from_file(content, file.filename, db)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process student upload: {str(e)}")

@router.post("/upload-faculty")
async def upload_faculty(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    try:
        content = await file.read()
        res = import_faculty_from_file(content, file.filename, db)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process faculty upload: {str(e)}")

@router.post("/upload-rooms")
async def upload_rooms(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    try:
        content = await file.read()
        res = import_rooms_from_file(content, file.filename, db)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process room upload: {str(e)}")

@router.get("/students")
def get_students(
    branch: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    query = db.query(models.Student)
    if branch:
        query = query.filter(models.Student.branch == branch.strip().upper())
    total = query.count()
    items = query.order_by(models.Student.roll_number).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": s.id,
                "roll_number": s.roll_number,
                "name": s.name,
                "branch": s.branch,
                "semester": s.semester,
                "is_backlog": s.is_backlog,
            }
            for s in items
        ]
    }

@router.get("/branches")
def get_branches_summary(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    """Returns list of branches with student counts and min/max roll numbers for Selector tool."""
    from sqlalchemy import func
    results = (
        db.query(
            models.Student.branch,
            func.count(models.Student.id).label("student_count"),
            func.min(models.Student.roll_number).label("min_roll"),
            func.max(models.Student.roll_number).label("max_roll"),
        )
        .group_by(models.Student.branch)
        .order_by(models.Student.branch)
        .all()
    )
    return [
        {
            "branch": r[0],
            "student_count": r[1],
            "min_roll": r[2],
            "max_roll": r[3],
        }
        for r in results
    ]

@router.get("/rooms")
def get_rooms(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    rooms = db.query(models.Room).order_by(models.Room.room_number).all()
    return [
        {
            "id": r.id,
            "room_number": r.room_number,
            "block": r.block,
            "floor": r.floor,
            "rows": r.rows,
            "columns": r.columns,
            "bench_count": len(r.benches),
            "exam_capacity": r.exam_capacity,
            "total_physical_capacity": r.total_physical_capacity,
        }
        for r in rooms
    ]

@router.get("/faculty")
def get_faculty(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    faculty_list = db.query(models.Faculty).order_by(models.Faculty.cumulative_duties, models.Faculty.name).all()
    return [
        {
            "id": f.id,
            "faculty_id": f.faculty_id,
            "name": f.name,
            "department": f.department,
            "rank": f.rank,
            "cumulative_duties": f.cumulative_duties,
            "is_available": f.is_available,
        }
        for f in faculty_list
    ]

@router.get("/sessions")
def get_sessions(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    sessions = db.query(models.ExamSession).order_by(models.ExamSession.exam_date.desc()).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "exam_date": s.exam_date,
            "shift": s.shift,
            "exam_type": s.exam_type,
            "is_active": s.is_active,
        }
        for s in sessions
    ]

@router.post("/sessions")
def create_session(
    payload: SessionCreateRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    session = models.ExamSession(
        name=payload.name.strip(),
        exam_date=payload.exam_date.strip(),
        shift=payload.shift.strip(),
        exam_type=payload.exam_type.strip(),
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "name": session.name,
        "exam_date": session.exam_date,
        "shift": session.shift,
        "exam_type": session.exam_type,
    }

@router.get("/audit-logs")
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "timestamp": log.created_at.isoformat(),
        }
        for log in logs
    ]

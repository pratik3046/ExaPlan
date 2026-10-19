from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database import models
from app.core.deps import require_admin_or_coordinator
from app.engines.seating_engine import SeatingEngine
from app.engines.invigilation_engine import InvigilationEngine
from app.schemas.engine import (
    SeatingGenerationRequest,
    SeatingGenerationResponse,
    SwapValidationRequest,
    SwapValidationResponse,
    InvigilationGenerationRequest,
    InvigilationGenerationResponse,
)

router = APIRouter(prefix="/engine", tags=["Algorithm Engines"])

@router.post("/generate-seating", response_model=SeatingGenerationResponse)
def generate_seating(
    payload: SeatingGenerationRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    try:
        engine = SeatingEngine(db)
        return engine.generate_seating(payload)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seating allocation failed: {str(e)}")

@router.post("/validate-swap", response_model=SwapValidationResponse)
def validate_swap(
    payload: SwapValidationRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    try:
        engine = SeatingEngine(db)
        return engine.validate_and_swap(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Swap execution failed: {str(e)}")

@router.post("/generate-invigilation", response_model=InvigilationGenerationResponse)
def generate_invigilation(
    payload: InvigilationGenerationRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    try:
        engine = InvigilationEngine(db)
        return engine.generate_invigilation(payload)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invigilation generation failed: {str(e)}")

@router.get("/room-matrix/{session_id}/{room_id}")
def get_room_matrix(
    session_id: int,
    room_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_or_coordinator),
):
    """
    Returns visual bench grid layout for the Interactive Review Matrix:
    - Benches arranged by row and col
    - Seats on each bench (LEFT, RIGHT or SINGLE) with student roll, name, branch
    - Invigilator(s) assigned to this room
    """
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    session = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch invigilators
    invigilators = (
        db.query(models.InvigilationAllocation)
        .filter(
            models.InvigilationAllocation.session_id == session_id,
            models.InvigilationAllocation.room_id == room_id,
        )
        .all()
    )

    # Fetch benches and their allocations
    benches = (
        db.query(models.RoomBench)
        .filter(models.RoomBench.room_id == room_id, models.RoomBench.is_active == True)
        .order_by(models.RoomBench.row, models.RoomBench.col)
        .all()
    )

    allocations = (
        db.query(models.SeatingAllocation)
        .filter(
            models.SeatingAllocation.session_id == session_id,
            models.SeatingAllocation.room_id == room_id,
        )
        .all()
    )

    alloc_by_bench = {}
    for a in allocations:
        alloc_by_bench.setdefault(a.bench_id, []).append(a)

    benches_data = []
    for b in benches:
        bench_allocs = alloc_by_bench.get(b.id, [])
        seats = []
        for a in bench_allocs:
            seats.append({
                "allocation_id": a.id,
                "seat_position": a.seat_position,
                "student_id": a.student.id,
                "roll_number": a.student.roll_number,
                "name": a.student.name,
                "branch": a.student.branch,
                "semester": a.student.semester,
                "is_backlog": a.student.is_backlog,
            })
        benches_data.append({
            "bench_id": b.id,
            "bench_number": b.bench_number,
            "row": b.row,
            "col": b.col,
            "seats": seats,
        })

    return {
        "session_id": session.id,
        "session_name": session.name,
        "exam_type": session.exam_type,
        "room_id": room.id,
        "room_number": room.room_number,
        "rows": room.rows,
        "columns": room.columns,
        "invigilators": [
            {
                "faculty_id": inv.faculty.id,
                "faculty_code": inv.faculty.faculty_id,
                "name": inv.faculty.name,
                "rank": inv.faculty.rank,
                "duty_role": inv.duty_role,
            }
            for inv in invigilators
        ],
        "benches": benches_data,
    }

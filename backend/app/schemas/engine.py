from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from enum import Enum

class SeatingMode(str, Enum):
    SINGLE = "SINGLE"
    PAIRED = "PAIRED"

class BranchRangeInput(BaseModel):
    branch: str = Field(..., min_length=1, max_length=50)
    start_roll: str = Field(..., min_length=1, max_length=50)
    end_roll: str = Field(..., min_length=1, max_length=50)

class SeatingGenerationRequest(BaseModel):
    session_id: int = Field(..., gt=0)
    room_id: int = Field(..., gt=0)
    seating_mode: SeatingMode = SeatingMode.PAIRED
    branch_a: BranchRangeInput
    branch_b: Optional[BranchRangeInput] = None

class SeatAllocationItem(BaseModel):
    bench_id: int
    bench_number: int
    row: int
    col: int
    seat_position: str  # LEFT, RIGHT, SINGLE
    student_id: int
    roll_number: str
    name: str
    branch: str

class SeatingGenerationResponse(BaseModel):
    session_id: int
    room_id: int
    room_number: str
    seating_mode: str
    exam_type: str
    total_allocated: int
    unallocated_count_branch_a: int
    unallocated_count_branch_b: int
    allocations: List[SeatAllocationItem]
    warnings: List[str] = []

class SwapValidationRequest(BaseModel):
    session_id: int = Field(..., gt=0)
    allocation_id_1: int = Field(..., gt=0)
    allocation_id_2: int = Field(..., gt=0)

class SwapValidationResponse(BaseModel):
    valid: bool
    reason: str

class InvigilationGenerationRequest(BaseModel):
    session_id: int = Field(..., gt=0)
    room_ids: List[int] = Field(..., min_length=1)

class InvigilationAllocationItem(BaseModel):
    room_id: int
    room_number: str
    faculty_id: int
    faculty_code: str
    faculty_name: str
    rank: str
    duty_role: str
    current_duties: int

class InvigilationGenerationResponse(BaseModel):
    session_id: int
    exam_type: str
    total_rooms: int
    allocations: List[InvigilationAllocationItem]
    warnings: List[str] = []

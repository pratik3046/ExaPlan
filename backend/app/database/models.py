import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Text,
    Enum
)
from sqlalchemy.orm import relationship
from app.database.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    COORDINATOR = "coordinator"
    FACULTY = "faculty"
    STUDENT = "student"

class ExamType(str, enum.Enum):
    MIDTERM = "Midterm"
    ENDTERM = "Endterm"

class SeatPosition(str, enum.Enum):
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    SINGLE = "SINGLE"

class FacultyRank(str, enum.Enum):
    SENIOR = "Senior"
    JUNIOR = "Junior"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.STUDENT.value, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    audit_logs = relationship("AuditLog", back_populates="user")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    branch = Column(String(50), index=True, nullable=False)
    semester = Column(Integer, nullable=False)
    is_backlog = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    seating_allocations = relationship("SeatingAllocation", back_populates="student")


class Faculty(Base):
    __tablename__ = "faculty_master"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False)
    rank = Column(String(50), default=FacultyRank.JUNIOR.value, nullable=False)  # Senior or Junior
    cumulative_duties = Column(Integer, default=0, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    leaves = relationship("FacultyLeave", back_populates="faculty", cascade="all, delete-orphan")
    invigilation_allocations = relationship("InvigilationAllocation", back_populates="faculty")


class FacultyLeave(Base):
    __tablename__ = "faculty_leaves"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty_master.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(50), nullable=False)
    session_id = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=True)
    reason = Column(String(255), nullable=True)

    faculty = relationship("Faculty", back_populates="leaves")


class Room(Base):
    __tablename__ = "room_master"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(50), unique=True, index=True, nullable=False)
    block = Column(String(50), nullable=True)
    floor = Column(Integer, nullable=True)
    total_physical_capacity = Column(Integer, nullable=False)
    exam_capacity = Column(Integer, nullable=False)
    rows = Column(Integer, default=1, nullable=False)
    columns = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    benches = relationship("RoomBench", back_populates="room", cascade="all, delete-orphan")
    seating_allocations = relationship("SeatingAllocation", back_populates="room")
    invigilation_allocations = relationship("InvigilationAllocation", back_populates="room")


class RoomBench(Base):
    __tablename__ = "room_benches"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("room_master.id", ondelete="CASCADE"), nullable=False)
    bench_number = Column(Integer, nullable=False)
    row = Column(Integer, nullable=False)
    col = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    room = relationship("Room", back_populates="benches")
    seating_allocations = relationship("SeatingAllocation", back_populates="bench")

    __table_args__ = (
        UniqueConstraint("room_id", "bench_number", name="uq_room_bench_number"),
        UniqueConstraint("room_id", "row", "col", name="uq_room_bench_position"),
    )


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    exam_date = Column(String(50), nullable=False)
    shift = Column(String(50), nullable=False)  # Morning, Afternoon, etc.
    exam_type = Column(String(50), default=ExamType.MIDTERM.value, nullable=False)  # Midterm or Endterm
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    seating_allocations = relationship("SeatingAllocation", back_populates="session", cascade="all, delete-orphan")
    invigilation_allocations = relationship("InvigilationAllocation", back_populates="session", cascade="all, delete-orphan")


class SeatingAllocation(Base):
    __tablename__ = "seating_allocations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False)
    room_id = Column(Integer, ForeignKey("room_master.id", ondelete="CASCADE"), nullable=False)
    bench_id = Column(Integer, ForeignKey("room_benches.id", ondelete="CASCADE"), nullable=False)
    seat_position = Column(String(20), nullable=False)  # LEFT, RIGHT, SINGLE
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    allocated_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    session = relationship("ExamSession", back_populates="seating_allocations")
    room = relationship("Room", back_populates="seating_allocations")
    bench = relationship("RoomBench", back_populates="seating_allocations")
    student = relationship("Student", back_populates="seating_allocations")

    __table_args__ = (
        # Prevent double-booking a physical seat in a session
        UniqueConstraint("session_id", "room_id", "bench_id", "seat_position", name="uq_session_seat"),
        # Prevent double-booking a student in multiple seats in the same session
        UniqueConstraint("session_id", "student_id", name="uq_session_student"),
    )


class InvigilationAllocation(Base):
    __tablename__ = "invigilation_allocations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False)
    room_id = Column(Integer, ForeignKey("room_master.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculty_master.id", ondelete="CASCADE"), nullable=False)
    duty_role = Column(String(50), nullable=False)  # Senior Invigilator, Junior Invigilator, Sole Invigilator
    allocated_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    session = relationship("ExamSession", back_populates="invigilation_allocations")
    room = relationship("Room", back_populates="invigilation_allocations")
    faculty = relationship("Faculty", back_populates="invigilation_allocations")

    __table_args__ = (
        # A faculty member cannot be in two rooms in the same exam session
        UniqueConstraint("session_id", "faculty_id", name="uq_session_faculty"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", back_populates="audit_logs")

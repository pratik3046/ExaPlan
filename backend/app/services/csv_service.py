import io
import pandas as pd
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.database import models

def read_df_from_upload(content: bytes, filename: str) -> pd.DataFrame:
    """Safely parses CSV or Excel bytes into a string-sanitized pandas DataFrame."""
    buffer = io.BytesIO(content)
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        df = pd.read_excel(buffer, dtype=str)
    else:
        df = pd.read_csv(buffer, dtype=str)
    
    # Strip whitespace and normalize column names
    df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]
    # Clean cells
    df = df.map(lambda x: str(x).strip() if pd.notnull(x) else "")
    return df

def import_students_from_file(content: bytes, filename: str, db: Session) -> Dict[str, Any]:
    df = read_df_from_upload(content, filename)
    
    required_cols = {"roll_number", "name", "branch", "semester"}
    if not required_cols.issubset(set(df.columns)):
        missing = required_cols - set(df.columns)
        raise ValueError(f"Missing required columns in student file: {', '.join(missing)}")

    created_count = 0
    updated_count = 0
    errors: List[str] = []

    for idx, row in df.iterrows():
        roll = row.get("roll_number", "").strip().upper()
        name = row.get("name", "").strip()
        branch = row.get("branch", "").strip().upper()
        sem_str = row.get("semester", "1").strip()
        is_backlog_val = str(row.get("is_backlog", "false")).strip().lower() in ("true", "1", "yes", "t")

        if not roll or not name or not branch:
            errors.append(f"Row {idx+2}: Roll number, name, and branch cannot be blank.")
            continue

        try:
            semester = int(sem_str) if sem_str.isdigit() else 1
        except ValueError:
            semester = 1

        existing = db.query(models.Student).filter(models.Student.roll_number == roll).first()
        if existing:
            existing.name = name
            existing.branch = branch
            existing.semester = semester
            existing.is_backlog = is_backlog_val
            updated_count += 1
        else:
            student = models.Student(
                roll_number=roll,
                name=name,
                branch=branch,
                semester=semester,
                is_backlog=is_backlog_val,
            )
            db.add(student)
            created_count += 1

    db.commit()
    return {
        "success": True,
        "created": created_count,
        "updated": updated_count,
        "total_processed": len(df),
        "errors": errors,
    }

def import_faculty_from_file(content: bytes, filename: str, db: Session) -> Dict[str, Any]:
    df = read_df_from_upload(content, filename)
    
    required_cols = {"faculty_id", "name", "department"}
    if not required_cols.issubset(set(df.columns)):
        missing = required_cols - set(df.columns)
        raise ValueError(f"Missing required columns in faculty file: {', '.join(missing)}")

    created_count = 0
    updated_count = 0
    errors: List[str] = []

    for idx, row in df.iterrows():
        f_id = row.get("faculty_id", "").strip().upper()
        name = row.get("name", "").strip()
        dept = row.get("department", "").strip()
        rank_raw = row.get("rank", "Junior").strip().capitalize()
        rank = models.FacultyRank.SENIOR.value if rank_raw == "Senior" else models.FacultyRank.JUNIOR.value
        
        duties_str = row.get("cumulative_duties", "0").strip()
        cumulative_duties = int(duties_str) if duties_str.isdigit() else 0

        if not f_id or not name:
            errors.append(f"Row {idx+2}: Faculty ID and name cannot be blank.")
            continue

        existing = db.query(models.Faculty).filter(models.Faculty.faculty_id == f_id).first()
        if existing:
            existing.name = name
            existing.department = dept
            existing.rank = rank
            existing.cumulative_duties = cumulative_duties
            updated_count += 1
        else:
            faculty = models.Faculty(
                faculty_id=f_id,
                name=name,
                department=dept,
                rank=rank,
                cumulative_duties=cumulative_duties,
                is_available=True,
            )
            db.add(faculty)
            created_count += 1

    db.commit()
    return {
        "success": True,
        "created": created_count,
        "updated": updated_count,
        "total_processed": len(df),
        "errors": errors,
    }

def import_rooms_from_file(content: bytes, filename: str, db: Session) -> Dict[str, Any]:
    df = read_df_from_upload(content, filename)
    
    required_cols = {"room_number", "rows", "columns"}
    if not required_cols.issubset(set(df.columns)):
        missing = required_cols - set(df.columns)
        raise ValueError(f"Missing required columns in room file: {', '.join(missing)}")

    created_count = 0
    updated_count = 0
    errors: List[str] = []

    for idx, row in df.iterrows():
        room_num = row.get("room_number", "").strip().upper()
        block = row.get("block", "").strip()
        floor_str = row.get("floor", "1").strip()
        rows_str = row.get("rows", "5").strip()
        cols_str = row.get("columns", "5").strip()

        if not room_num:
            errors.append(f"Row {idx+2}: Room number cannot be blank.")
            continue

        try:
            floor = int(floor_str) if floor_str.lstrip("-").isdigit() else 1
            rows = max(1, int(rows_str)) if rows_str.isdigit() else 5
            columns = max(1, int(cols_str)) if cols_str.isdigit() else 5
        except ValueError:
            rows, columns, floor = 5, 5, 1

        benches_count = rows * columns
        # Paired seating capacity is 2 * benches_count
        exam_cap = benches_count * 2
        total_cap = benches_count * 2

        existing = db.query(models.Room).filter(models.Room.room_number == room_num).first()
        if existing:
            existing.block = block
            existing.floor = floor
            existing.rows = rows
            existing.columns = columns
            existing.exam_capacity = exam_cap
            existing.total_physical_capacity = total_cap
            room = existing
            updated_count += 1
        else:
            room = models.Room(
                room_number=room_num,
                block=block,
                floor=floor,
                rows=rows,
                columns=columns,
                total_physical_capacity=total_cap,
                exam_capacity=exam_cap,
            )
            db.add(room)
            db.flush()
            created_count += 1

        # Regenerate benches geometry for this room
        db.query(models.RoomBench).filter(models.RoomBench.room_id == room.id).delete(synchronize_session=False)
        bench_num = 1
        benches_to_create = []
        for r in range(1, rows + 1):
            for c in range(1, columns + 1):
                benches_to_create.append(
                    models.RoomBench(
                        room_id=room.id,
                        bench_number=bench_num,
                        row=r,
                        col=c,
                        is_active=True,
                    )
                )
                bench_num += 1
        db.bulk_save_objects(benches_to_create)

    db.commit()
    return {
        "success": True,
        "created": created_count,
        "updated": updated_count,
        "total_processed": len(df),
        "errors": errors,
    }

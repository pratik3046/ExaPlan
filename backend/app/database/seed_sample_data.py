from app.database.session import SessionLocal
from app.database import models

def seed_sample_data():
    db = SessionLocal()
    try:
        # 1. Sessions
        existing_session = db.query(models.ExamSession).first()
        if not existing_session:
            s1 = models.ExamSession(
                name="2026 Autumn Midterm Examinations",
                exam_date="2026-11-10",
                shift="Morning (09:30 - 12:30)",
                exam_type="Midterm",
                is_active=True,
            )
            s2 = models.ExamSession(
                name="2026 Winter Endterm Examinations",
                exam_date="2026-12-15",
                shift="Morning (09:30 - 12:30)",
                exam_type="Endterm",
                is_active=True,
            )
            db.add_all([s1, s2])
            db.commit()
            print("Seeded exam sessions.")

        # 2. Rooms & Benches
        existing_room = db.query(models.Room).first()
        if not existing_room:
            r101 = models.Room(
                room_number="101",
                block="Block A",
                floor=1,
                rows=4,
                columns=4,
                total_physical_capacity=32,
                exam_capacity=32,
            )
            r102 = models.Room(
                room_number="102",
                block="Block A",
                floor=1,
                rows=5,
                columns=4,
                total_physical_capacity=40,
                exam_capacity=40,
            )
            db.add_all([r101, r102])
            db.flush()

            # Generate Benches for R101 (16 benches)
            benches = []
            b_idx = 1
            for r in range(1, 5):
                for c in range(1, 5):
                    benches.append(models.RoomBench(room_id=r101.id, bench_number=b_idx, row=r, col=c, is_active=True))
                    b_idx += 1

            # Generate Benches for R102 (20 benches)
            b_idx = 1
            for r in range(1, 6):
                for c in range(1, 5):
                    benches.append(models.RoomBench(room_id=r102.id, bench_number=b_idx, row=r, col=c, is_active=True))
                    b_idx += 1

            db.bulk_save_objects(benches)
            db.commit()
            print("Seeded rooms and benches.")

        # 3. Students
        existing_student = db.query(models.Student).first()
        if not existing_student:
            students = []
            # CSE: 25 students
            for i in range(1, 26):
                roll = f"CSE-{i:03d}"
                students.append(models.Student(
                    roll_number=roll,
                    name=f"CSE Student {i:02d}",
                    branch="CSE",
                    semester=5,
                    is_backlog=(i % 8 == 0),
                ))
            # ECE: 25 students
            for i in range(1, 26):
                roll = f"ECE-{i:03d}"
                students.append(models.Student(
                    roll_number=roll,
                    name=f"ECE Student {i:02d}",
                    branch="ECE",
                    semester=5,
                    is_backlog=(i % 9 == 0),
                ))
            # MECH: 20 students
            for i in range(1, 21):
                roll = f"MECH-{i:03d}"
                students.append(models.Student(
                    roll_number=roll,
                    name=f"MECH Student {i:02d}",
                    branch="MECH",
                    semester=5,
                    is_backlog=False,
                ))
            db.bulk_save_objects(students)
            db.commit()
            print("Seeded students.")

        # 4. Faculty
        existing_faculty = db.query(models.Faculty).first()
        if not existing_faculty:
            faculties = [
                models.Faculty(faculty_id="FAC-001", name="Dr. A. Sharma", department="Computer Science", rank="Senior", cumulative_duties=2),
                models.Faculty(faculty_id="FAC-002", name="Dr. R. Verma", department="Electronics", rank="Senior", cumulative_duties=1),
                models.Faculty(faculty_id="FAC-003", name="Prof. M. Gupta", department="Mechanical", rank="Senior", cumulative_duties=4),
                models.Faculty(faculty_id="FAC-004", name="Dr. S. Nair", department="Computer Science", rank="Junior", cumulative_duties=0),
                models.Faculty(faculty_id="FAC-005", name="Prof. K. Patel", department="Electronics", rank="Junior", cumulative_duties=1),
                models.Faculty(faculty_id="FAC-006", name="Dr. P. Deshmukh", department="Civil", rank="Junior", cumulative_duties=0),
            ]
            db.bulk_save_objects(faculties)
            db.commit()
            print("Seeded faculty members.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_sample_data()

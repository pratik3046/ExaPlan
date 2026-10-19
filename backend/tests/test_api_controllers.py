import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from app.database.session import Base
from app.database import models
from app.core.security import get_password_hash, create_access_token
from app.core.deps import decode_access_token
from app.schemas.auth import LoginRequest
from app.api.auth import login
from app.api.lookup import student_lookup, faculty_schedule
from app.services.csv_service import (
    import_students_from_file,
    import_faculty_from_file,
    import_rooms_from_file,
)

class TestApiAndControllers(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        SessionTest = sessionmaker(bind=self.engine)
        self.db = SessionTest()

        # Seed admin user
        self.admin_user = models.User(
            username="admin_test",
            email="admin@test.edu",
            hashed_password=get_password_hash("secretpass"),
            role=models.UserRole.ADMIN.value,
            is_active=True,
        )
        # Seed regular student user
        self.student_user = models.User(
            username="student_test",
            email="student@test.edu",
            hashed_password=get_password_hash("studentpass"),
            role=models.UserRole.STUDENT.value,
            is_active=True,
        )
        self.db.add_all([self.admin_user, self.student_user])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_auth_login_success(self):
        req = LoginRequest(username="admin_test", password="secretpass")
        res = login(req, db=self.db)
        self.assertEqual(res.role, "admin")
        self.assertEqual(res.username, "admin_test")
        self.assertTrue(len(res.access_token) > 20)

        # Decode token and verify claims
        payload = decode_access_token(res.access_token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], "admin_test")
        self.assertEqual(payload["role"], "admin")

    def test_auth_login_invalid_credentials(self):
        req = LoginRequest(username="admin_test", password="wrongpassword")
        with self.assertRaises(HTTPException) as ctx:
            login(req, db=self.db)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_csv_import_services(self):
        # 1. Test Student CSV Import
        student_csv = b"roll_number,name,branch,semester,is_backlog\nCSE-101,John Doe,CSE,4,False\nCSE-102,Jane Smith,CSE,4,True"
        res_stu = import_students_from_file(student_csv, "students.csv", self.db)
        self.assertEqual(res_stu["created"], 2)
        self.assertEqual(self.db.query(models.Student).count(), 2)

        # 2. Test Faculty CSV Import
        faculty_csv = b"faculty_id,name,department,rank,cumulative_duties\nFAC-01,Dr. Alan,CSE,Senior,2\nFAC-02,Prof. Grace,ECE,Junior,0"
        res_fac = import_faculty_from_file(faculty_csv, "faculty.csv", self.db)
        self.assertEqual(res_fac["created"], 2)
        self.assertEqual(self.db.query(models.Faculty).count(), 2)

        # 3. Test Room CSV Import & Bench Generation
        room_csv = b"room_number,block,floor,rows,columns\nLH-1,A,2,3,4"
        res_room = import_rooms_from_file(room_csv, "rooms.csv", self.db)
        self.assertEqual(res_room["created"], 1)
        room = self.db.query(models.Room).filter(models.Room.room_number == "LH-1").first()
        self.assertIsNotNone(room)
        # 3 rows * 4 columns = 12 benches
        self.assertEqual(len(room.benches), 12)
        self.assertEqual(room.exam_capacity, 24)

    def test_student_and_faculty_lookup_endpoints(self):
        # Seed student
        student = models.Student(roll_number="CSE-999", name="Lookup Tester", branch="CSE", semester=6)
        self.db.add(student)
        # Seed faculty
        faculty = models.Faculty(faculty_id="FAC-999", name="Lookup Faculty", department="CSE", rank="Senior", cumulative_duties=4)
        self.db.add(faculty)
        self.db.commit()

        # Lookup existing student
        res_stu = student_lookup("CSE-999", db=self.db)
        self.assertEqual(res_stu["student"]["name"], "Lookup Tester")

        # Lookup non-existent student raises 404
        with self.assertRaises(HTTPException) as ctx:
            student_lookup("UNKNOWN-000", db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

        # Lookup existing faculty
        res_fac = faculty_schedule("FAC-999", db=self.db)
        self.assertEqual(res_fac["faculty"]["name"], "Lookup Faculty")

        # Lookup non-existent faculty raises 404
        with self.assertRaises(HTTPException) as ctx:
            faculty_schedule("UNKNOWN-FAC", db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

if __name__ == "__main__":
    unittest.main()

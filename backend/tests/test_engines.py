import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.session import Base
from app.database import models
from app.engines.seating_engine import SeatingEngine, is_roll_in_range
from app.engines.invigilation_engine import InvigilationEngine
from app.schemas.engine import (
    SeatingGenerationRequest,
    BranchRangeInput,
    SeatingMode,
    SwapValidationRequest,
    InvigilationGenerationRequest,
)

class TestAlgorithmEngines(unittest.TestCase):
    def setUp(self):
        # In-memory SQLite for isolated, fast unit testing of algorithm engines
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        SessionTest = sessionmaker(bind=self.engine)
        self.db = SessionTest()

        # Seed Test Data: Exam Sessions (Midterm and Endterm)
        self.session_midterm = models.ExamSession(
            name="2026 Midterm",
            exam_date="2026-11-01",
            shift="Morning",
            exam_type="Midterm",
        )
        self.session_endterm = models.ExamSession(
            name="2026 Endterm",
            exam_date="2026-12-01",
            shift="Morning",
            exam_type="Endterm",
        )
        self.db.add_all([self.session_midterm, self.session_endterm])
        self.db.commit()

        # Seed Room with 5 Benches (Total capacity: 10 students paired, 5 single)
        self.room = models.Room(
            room_number="R101",
            total_physical_capacity=10,
            exam_capacity=10,
            rows=5,
            columns=1,
        )
        self.db.add(self.room)
        self.db.commit()

        self.benches = []
        for i in range(1, 6):
            bench = models.RoomBench(
                room_id=self.room.id,
                bench_number=i,
                row=i,
                col=1,
                is_active=True,
            )
            self.benches.append(bench)
            self.db.add(bench)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_roll_number_range_filtering(self):
        self.assertTrue(is_roll_in_range("CSE-005", "CSE-001", "CSE-010"))
        self.assertFalse(is_roll_in_range("CSE-015", "CSE-001", "CSE-010"))
        self.assertTrue(is_roll_in_range("ECE-20", "ECE-10", "ECE-30"))

    def test_edge_case_missing_and_dropped_roll_numbers(self):
        """
        Rule 4 Edge Case: Range specifies CSE-01 to CSE-05, but CSE-03 dropped out / missing.
        Engine must allocate CSE-01, CSE-02, CSE-04 without empty bench gaps.
        """
        students = [
            models.Student(roll_number="CSE-01", name="Alice", branch="CSE", semester=4),
            models.Student(roll_number="CSE-02", name="Bob", branch="CSE", semester=4),
            # Note: CSE-03 is intentionally omitted (dropped)
            models.Student(roll_number="CSE-04", name="Charlie", branch="CSE", semester=4),
        ]
        self.db.add_all(students)
        self.db.commit()

        engine = SeatingEngine(self.db)
        req = SeatingGenerationRequest(
            session_id=self.session_midterm.id,
            room_id=self.room.id,
            seating_mode=SeatingMode.SINGLE,
            branch_a=BranchRangeInput(branch="CSE", start_roll="CSE-01", end_roll="CSE-05"),
        )
        res = engine.generate_seating(req)

        self.assertEqual(res.total_allocated, 3)
        # Verify benches 1, 2, 3 are filled with consecutive valid students
        allocated_rolls = [item.roll_number for item in res.allocations]
        self.assertEqual(allocated_rolls, ["CSE-01", "CSE-02", "CSE-04"])
        # Verify bench numbers are consecutive (1, 2, 3), no gaps left
        bench_nums = [item.bench_number for item in res.allocations]
        self.assertEqual(bench_nums, [1, 2, 3])

    def test_edge_case_uneven_branches_and_branch_isolation(self):
        """
        Rule 4 Edge Case: Branch A has 4 students, Branch B has 2 students.
        Paired seating must ensure:
        - Benches 1 and 2 have Left (Branch A) and Right (Branch B).
        - Benches 3 and 4 have Left (Branch A) and NO Right seat from Branch A.
        - Strictly prevents two students of Branch A from sharing a bench!
        """
        students_a = [
            models.Student(roll_number=f"CSE-0{i}", name=f"CSE Student {i}", branch="CSE", semester=4)
            for i in range(1, 5)
        ]
        students_b = [
            models.Student(roll_number=f"ECE-0{i}", name=f"ECE Student {i}", branch="ECE", semester=4)
            for i in range(1, 3)
        ]
        self.db.add_all(students_a + students_b)
        self.db.commit()

        engine = SeatingEngine(self.db)
        req = SeatingGenerationRequest(
            session_id=self.session_midterm.id,
            room_id=self.room.id,
            seating_mode=SeatingMode.PAIRED,
            branch_a=BranchRangeInput(branch="CSE", start_roll="CSE-01", end_roll="CSE-10"),
            branch_b=BranchRangeInput(branch="ECE", start_roll="ECE-01", end_roll="ECE-10"),
        )
        res = engine.generate_seating(req)

        self.assertEqual(res.total_allocated, 6)  # 4 CSE + 2 ECE
        # Check bench isolation: no bench contains two students of the same branch
        benches_map = {}
        for alloc in res.allocations:
            benches_map.setdefault(alloc.bench_number, []).append(alloc.branch)

        for bench_no, branches in benches_map.items():
            if len(branches) > 1:
                self.assertNotEqual(branches[0], branches[1], f"Branch isolation violated on Bench {bench_no}")

    def test_endterm_capacity_lock_and_single_seating(self):
        """
        PRD Section 3.2: Endterm enforces 50% capacity lock.
        Even if Paired is requested, only 1 student per bench is allocated.
        """
        students = [
            models.Student(roll_number=f"CSE-0{i}", name=f"CSE Student {i}", branch="CSE", semester=4)
            for i in range(1, 6)
        ]
        self.db.add_all(students)
        self.db.commit()

        engine = SeatingEngine(self.db)
        req = SeatingGenerationRequest(
            session_id=self.session_endterm.id,
            room_id=self.room.id,
            seating_mode=SeatingMode.PAIRED,  # Requesting paired in Endterm
            branch_a=BranchRangeInput(branch="CSE", start_roll="CSE-01", end_roll="CSE-10"),
        )
        res = engine.generate_seating(req)

        self.assertEqual(res.seating_mode, "SINGLE")
        self.assertTrue(any("50% capacity lock" in w for w in res.warnings))
        self.assertEqual(len(res.allocations), 5)
        for item in res.allocations:
            self.assertEqual(item.seat_position, "SINGLE")

    def test_interactive_swap_validation_branch_conflict(self):
        """
        Interactive Matrix: Swapping students must reject swaps that place
        two students of the same branch on the same bench.
        """
        # Bench 1: CSE-01 (Left), ECE-01 (Right)
        # Bench 2: CSE-02 (Left), ECE-02 (Right)
        s_c1 = models.Student(roll_number="CSE-01", name="C1", branch="CSE", semester=4)
        s_e1 = models.Student(roll_number="ECE-01", name="E1", branch="ECE", semester=4)
        s_c2 = models.Student(roll_number="CSE-02", name="C2", branch="CSE", semester=4)
        s_e2 = models.Student(roll_number="ECE-02", name="E2", branch="ECE", semester=4)
        self.db.add_all([s_c1, s_e1, s_c2, s_e2])
        self.db.commit()

        a1 = models.SeatingAllocation(session_id=self.session_midterm.id, room_id=self.room.id, bench_id=self.benches[0].id, seat_position="LEFT", student_id=s_c1.id)
        a2 = models.SeatingAllocation(session_id=self.session_midterm.id, room_id=self.room.id, bench_id=self.benches[0].id, seat_position="RIGHT", student_id=s_e1.id)
        a3 = models.SeatingAllocation(session_id=self.session_midterm.id, room_id=self.room.id, bench_id=self.benches[1].id, seat_position="LEFT", student_id=s_c2.id)
        a4 = models.SeatingAllocation(session_id=self.session_midterm.id, room_id=self.room.id, bench_id=self.benches[1].id, seat_position="RIGHT", student_id=s_e2.id)
        self.db.add_all([a1, a2, a3, a4])
        self.db.commit()

        engine = SeatingEngine(self.db)

        # Attempting to swap a2 (ECE-01 on Bench 1) with a3 (CSE-02 on Bench 2)
        # If swapped, Bench 1 would have CSE-01 and CSE-02 (Conflict!)
        swap_req = SwapValidationRequest(
            session_id=self.session_midterm.id,
            allocation_id_1=a2.id,
            allocation_id_2=a3.id,
        )
        swap_res = engine.validate_and_swap(swap_req)

        self.assertFalse(swap_res.valid)
        self.assertIn("Constraint violation", swap_res.reason)

        # Attempting valid swap: a1 (CSE-01 on Bench 1) with a3 (CSE-02 on Bench 2)
        valid_swap_req = SwapValidationRequest(
            session_id=self.session_midterm.id,
            allocation_id_1=a1.id,
            allocation_id_2=a3.id,
        )
        valid_res = engine.validate_and_swap(valid_swap_req)
        self.assertTrue(valid_res.valid)

    def test_invigilation_workload_balancing_and_endterm_pairing(self):
        """
        PRD Section 3.4:
        - Sort faculty by cumulative_duties ascending (workload balancing)
        - Disqualify on-leave faculty
        - Endterm hierarchical pairing: 1 Senior + 1 Junior per room
        """
        f_sen1 = models.Faculty(faculty_id="F-S1", name="Prof. Alpha", department="CSE", rank="Senior", cumulative_duties=5)
        f_sen2 = models.Faculty(faculty_id="F-S2", name="Prof. Beta", department="ECE", rank="Senior", cumulative_duties=1)
        f_jun1 = models.Faculty(faculty_id="F-J1", name="Dr. Gamma", department="ME", rank="Junior", cumulative_duties=3)
        f_jun2 = models.Faculty(faculty_id="F-J2", name="Dr. Delta", department="CE", rank="Junior", cumulative_duties=0)
        # Faculty on leave
        f_leave = models.Faculty(faculty_id="F-LV", name="Prof. Leave", department="CSE", rank="Senior", cumulative_duties=0)

        self.db.add_all([f_sen1, f_sen2, f_jun1, f_jun2, f_leave])
        self.db.commit()

        # Mark f_leave on leave for the Endterm date
        leave = models.FacultyLeave(faculty_id=f_leave.id, date=self.session_endterm.exam_date, reason="Medical")
        self.db.add(leave)
        self.db.commit()

        engine = InvigilationEngine(self.db)
        req = InvigilationGenerationRequest(
            session_id=self.session_endterm.id,
            room_ids=[self.room.id],
        )
        res = engine.generate_invigilation(req)

        self.assertEqual(len(res.allocations), 2)
        assigned_faculty_codes = [a.faculty_code for a in res.allocations]

        # Verify on-leave faculty was disqualified
        self.assertNotIn("F-LV", assigned_faculty_codes)

        # Verify lowest duty senior was selected (Prof. Beta, duty 1 < Prof. Alpha, duty 5)
        self.assertIn("F-S2", assigned_faculty_codes)

        # Verify lowest duty junior was selected (Dr. Delta, duty 0 < Dr. Gamma, duty 3)
        self.assertIn("F-J2", assigned_faculty_codes)

        # Verify roles
        roles = {a.faculty_code: a.duty_role for a in res.allocations}
        self.assertEqual(roles["F-S2"], "Senior Invigilator")
        self.assertEqual(roles["F-J2"], "Junior Invigilator")

if __name__ == "__main__":
    unittest.main()

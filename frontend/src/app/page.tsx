"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { SelectorTool } from "@/components/SelectorTool";
import { ExecutionStepper, StepState } from "@/components/ExecutionStepper";
import { InteractiveMatrix } from "@/components/InteractiveMatrix";
import { DataIngestionModal } from "@/components/DataIngestionModal";
import { StudentPortal } from "@/components/StudentPortal";
import { FacultyPortal } from "@/components/FacultyPortal";
import { LoginModal } from "@/components/LoginModal";
import { api } from "@/services/api";
import { Room, BranchSummary, ExamSession, RoomMatrixData, AuditLogItem } from "@/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"matrix" | "selector" | "data" | "student" | "faculty">("matrix");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  // Core Data
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Matrix State
  const [selectedRoomId, setSelectedRoomId] = useState<number>(0);
  const [matrixData, setMatrixData] = useState<RoomMatrixData | null>(null);

  // Stepper State
  const [stepperState, setStepperState] = useState<StepState>("idle");
  const [stepperError, setStepperError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  // Restore user session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("exaplan_user");
      const storedToken = localStorage.getItem("exaplan_token");
      if (storedUser && storedToken) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // ignore invalid parse
        }
      }
    }
  }, []);

  // Fetch initial master data
  const loadMasterData = async () => {
    try {
      const [sessionsData, roomsData, branchesData] = await Promise.all([
        api.getSessions().catch(() => []),
        api.getRooms().catch(() => []),
        api.getBranches().catch(() => []),
      ]);

      setSessions(sessionsData);
      if (sessionsData.length > 0 && !activeSessionId) {
        setActiveSessionId(sessionsData[0].id);
      }

      setRooms(roomsData);
      if (roomsData.length > 0 && !selectedRoomId) {
        setSelectedRoomId(roomsData[0].id);
      }

      setBranches(branchesData);
    } catch (err) {
      console.error("Master data load error:", err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await api.getAuditLogs().catch(() => []);
      setAuditLogs(logs);
    } catch (err) {
      console.error("Audit log error:", err);
    }
  };

  useEffect(() => {
    loadMasterData();
    loadAuditLogs();
  }, []);

  // Fetch matrix when activeSessionId or selectedRoomId changes
  const loadRoomMatrix = async () => {
    if (!activeSessionId || !selectedRoomId) return;
    setIsLoading(true);
    try {
      const data = await api.getRoomMatrix(activeSessionId, selectedRoomId);
      setMatrixData(data);
    } catch (err) {
      console.error("Matrix load failed:", err);
      setMatrixData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoomMatrix();
  }, [activeSessionId, selectedRoomId]);

  // Seating Engine Trigger Handler
  const handleRunSeatingEngine = async (payload: {
    room_id: number;
    seating_mode: string;
    branch_a: { branch: string; start_roll: string; end_roll: string };
    branch_b?: { branch: string; start_roll: string; end_roll: string };
  }) => {
    if (!activeSessionId) return;

    setStepperError(undefined);
    setStepperState("validating");
    setIsLoading(true);

    try {
      // 1. Validation phase delay for visual feedback
      await new Promise((r) => setTimeout(r, 600));
      setStepperState("allocating");

      // 2. Call Seating Engine
      const res = await api.generateSeating({
        session_id: activeSessionId,
        room_id: payload.room_id,
        seating_mode: payload.seating_mode,
        branch_a: payload.branch_a,
        branch_b: payload.branch_b,
      });

      // 3. Balancing phase: trigger invigilation automatically for this room
      setStepperState("balancing");
      await new Promise((r) => setTimeout(r, 600));

      await api.generateInvigilation({
        session_id: activeSessionId,
        room_ids: [payload.room_id],
      }).catch((e) => console.warn("Invigilation allocation warning:", e));

      setStepperState("completed");
      setSelectedRoomId(payload.room_id);
      await loadRoomMatrix();
      await loadAuditLogs();

      // Switch to matrix tab to review the generated layout
      setTimeout(() => {
        setActiveTab("matrix");
        setStepperState("idle");
      }, 1000);
    } catch (err: any) {
      setStepperState("error");
      setStepperError(err.message || "Seating allocation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Swap Handler
  const handleSwapSeats = async (alloc1Id: number, alloc2Id: number) => {
    if (!activeSessionId) return { valid: false, reason: "No active session selected" };
    try {
      const res = await api.validateAndSwap({
        session_id: activeSessionId,
        allocation_id_1: alloc1Id,
        allocation_id_2: alloc2Id,
      });
      if (res.valid) {
        await loadRoomMatrix();
        await loadAuditLogs();
      }
      return res;
    } catch (err: any) {
      return { valid: false, reason: err.message || "Swap failed" };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("exaplan_token");
    localStorage.removeItem("exaplan_user");
    setUser(null);
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6]">
      {/* Institutional Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sessions={sessions}
        activeSessionId={activeSessionId}
        setActiveSessionId={setActiveSessionId}
        user={user}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Algorithmic Execution Stepper (shown during allocation) */}
        <ExecutionStepper state={stepperState} errorMessage={stepperError} />

        {/* Tab 1: Interactive Review Matrix */}
        {activeTab === "matrix" && (
          <InteractiveMatrix
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
            matrixData={matrixData}
            onSwapSeats={handleSwapSeats}
            onRefresh={loadRoomMatrix}
            isLoading={isLoading}
          />
        )}

        {/* Tab 2: The Selector Tool */}
        {activeTab === "selector" && (
          <SelectorTool
            rooms={rooms}
            branches={branches}
            activeSession={activeSession}
            onRunEngine={handleRunSeatingEngine}
            isLoading={isLoading}
          />
        )}

        {/* Tab 3: Data Ingestion & Audit Logs */}
        {activeTab === "data" && (
          <DataIngestionModal
            onDataUploaded={() => {
              loadMasterData();
              loadAuditLogs();
            }}
            auditLogs={auditLogs}
            onRefreshLogs={loadAuditLogs}
          />
        )}

        {/* Tab 4: Student Lookup Portal */}
        {activeTab === "student" && <StudentPortal />}

        {/* Tab 5: Faculty Roster Portal */}
        {activeTab === "faculty" && <FacultyPortal />}
      </main>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(u) => {
          setUser(u);
          loadMasterData();
          loadAuditLogs();
        }}
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { Users, AlertTriangle, Sparkles, Building, ArrowRight, ShieldAlert } from "lucide-react";
import { Room, BranchSummary, ExamSession } from "@/types";

interface SelectorToolProps {
  rooms: Room[];
  branches: BranchSummary[];
  activeSession: ExamSession | null;
  onRunEngine: (payload: {
    room_id: number;
    seating_mode: string;
    branch_a: { branch: string; start_roll: string; end_roll: string };
    branch_b?: { branch: string; start_roll: string; end_roll: string };
  }) => Promise<void>;
  isLoading: boolean;
}

export const SelectorTool: React.FC<SelectorToolProps> = ({
  rooms,
  branches,
  activeSession,
  onRunEngine,
  isLoading,
}) => {
  const isEndterm = activeSession?.exam_type === "Endterm";

  const [selectedRoomId, setSelectedRoomId] = useState<number>(rooms[0]?.id || 0);
  const [seatingMode, setSeatingMode] = useState<"SINGLE" | "PAIRED">(isEndterm ? "SINGLE" : "PAIRED");

  // Branch A
  const [branchA, setBranchA] = useState<string>(branches[0]?.branch || "");
  const [startRollA, setStartRollA] = useState<string>("");
  const [endRollA, setEndRollA] = useState<string>("");

  // Branch B
  const [branchB, setBranchB] = useState<string>(branches[1]?.branch || "");
  const [startRollB, setStartRollB] = useState<string>("");
  const [endRollB, setEndRollB] = useState<string>("");

  useEffect(() => {
    if (branches.length > 0) {
      if (!branchA) {
        setBranchA(branches[0].branch);
        setStartRollA(branches[0].min_roll || "");
        setEndRollA(branches[0].max_roll || "");
      }
      if (branches.length > 1 && !branchB) {
        setBranchB(branches[1].branch);
        setStartRollB(branches[1].min_roll || "");
        setEndRollB(branches[1].max_roll || "");
      }
    }
  }, [branches]);

  useEffect(() => {
    if (isEndterm) {
      setSeatingMode("SINGLE");
    }
  }, [isEndterm]);

  const handleBranchAChange = (br: string) => {
    setBranchA(br);
    const found = branches.find((b) => b.branch === br);
    if (found) {
      setStartRollA(found.min_roll);
      setEndRollA(found.max_roll);
    }
  };

  const handleBranchBChange = (br: string) => {
    setBranchB(br);
    const found = branches.find((b) => b.branch === br);
    if (found) {
      setStartRollB(found.min_roll);
      setEndRollB(found.max_roll);
    }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;

    onRunEngine({
      room_id: selectedRoomId,
      seating_mode: seatingMode,
      branch_a: {
        branch: branchA,
        start_roll: startRollA,
        end_roll: endRollA,
      },
      branch_b:
        seatingMode === "PAIRED" && branchB
          ? {
              branch: branchB,
              start_roll: startRollB,
              end_roll: endRollB,
            }
          : undefined,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            The Selector Tool
          </h2>
          <p className="text-xs text-slate-300">
            Configure detached queues and assign roll number ranges to populate physical room geometry.
          </p>
        </div>

        {isEndterm ? (
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4" />
            Endterm Lock: 50% Capacity (Single Seating Enforced)
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs font-semibold">
            <Users className="w-4 h-4" />
            Midterm Mode: 100% Capacity Allowed
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Room & Mode Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Examination Room
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} ({r.rows}×{r.columns} grid, {r.bench_count} benches, Max {r.exam_capacity} seats)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Bench Configuration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => !isEndterm && setSeatingMode("PAIRED")}
                disabled={isEndterm}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition text-center ${
                  seatingMode === "PAIRED"
                    ? "bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm"
                    : isEndterm
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                Paired (2:1 Bench)
              </button>
              <button
                type="button"
                onClick={() => setSeatingMode("SINGLE")}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition text-center ${
                  seatingMode === "SINGLE"
                    ? "bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                Single (1:1 Bench)
              </button>
            </div>
          </div>
        </div>

        {/* Two-Column Occupant Range Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Occupant A */}
          <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-blue-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1E3A8A]"></span>
                Bench Occupant A (Left Position)
              </span>
              <span className="text-[11px] bg-blue-100 text-[#1E3A8A] px-2 py-0.5 rounded font-medium">
                Primary Branch
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                <select
                  value={branchA}
                  onChange={(e) => handleBranchAChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                >
                  {branches.map((b) => (
                    <option key={b.branch} value={b.branch}>
                      {b.branch} ({b.student_count} registered students)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Roll No.</label>
                  <input
                    type="text"
                    value={startRollA}
                    onChange={(e) => setStartRollA(e.target.value)}
                    placeholder="e.g. CSE-001"
                    required
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Roll No.</label>
                  <input
                    type="text"
                    value={endRollA}
                    onChange={(e) => setEndRollA(e.target.value)}
                    placeholder="e.g. CSE-060"
                    required
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Occupant B (Paired Mode Only) */}
          <div
            className={`border rounded-xl p-5 shadow-sm transition ${
              seatingMode === "PAIRED"
                ? "border-emerald-200 bg-emerald-50/40"
                : "border-slate-200 bg-slate-50 opacity-60 pointer-events-none"
            }`}
          >
            <div className="flex items-center justify-between mb-3 border-b border-emerald-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Bench Occupant B (Right Position)
              </span>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                Branch Mixing Partner
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                <select
                  value={branchB}
                  onChange={(e) => handleBranchBChange(e.target.value)}
                  disabled={seatingMode !== "PAIRED"}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {branches.map((b) => (
                    <option key={b.branch} value={b.branch} disabled={b.branch === branchA}>
                      {b.branch} {b.branch === branchA ? "(Cannot pair with same branch)" : `(${b.student_count} registered)`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Roll No.</label>
                  <input
                    type="text"
                    value={startRollB}
                    onChange={(e) => setStartRollB(e.target.value)}
                    placeholder="e.g. ECE-001"
                    disabled={seatingMode !== "PAIRED"}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Roll No.</label>
                  <input
                    type="text"
                    value={endRollB}
                    onChange={(e) => setEndRollB(e.target.value)}
                    placeholder="e.g. ECE-060"
                    disabled={seatingMode !== "PAIRED"}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Notes & Submit */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200">
          <div className="text-xs text-slate-500 space-y-1">
            <p className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              Detached Queues skip absent or missing roll numbers dynamically without leaving gaps.
            </p>
            <p className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Branch isolation strictly guarantees no two students of the same branch share a bench.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !selectedRoomId}
            className="w-full sm:w-auto px-6 py-3 bg-[#1E3A8A] hover:bg-[#172554] text-white text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>Executing Engines...</span>
            ) : (
              <>
                <span>Allocate Room Seating</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

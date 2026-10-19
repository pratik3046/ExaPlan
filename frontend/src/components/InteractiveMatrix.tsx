"use client";

import React, { useState } from "react";
import { ArrowLeftRight, AlertOctagon, CheckCircle2, UserCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { RoomMatrixData, SeatItem, Room } from "@/types";

interface InteractiveMatrixProps {
  rooms: Room[];
  selectedRoomId: number;
  onSelectRoom: (roomId: number) => void;
  matrixData: RoomMatrixData | null;
  onSwapSeats: (alloc1Id: number, alloc2Id: number) => Promise<{ valid: boolean; reason: string }>;
  onRefresh: () => void;
  isLoading: boolean;
}

export const InteractiveMatrix: React.FC<InteractiveMatrixProps> = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
  matrixData,
  onSwapSeats,
  onRefresh,
  isLoading,
}) => {
  const [selectedSeat, setSelectedSeat] = useState<SeatItem | null>(null);
  const [targetSeatError, setTargetSeatError] = useState<{ id: number; message: string } | null>(null);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapSuccessMsg, setSwapSuccessMsg] = useState<string | null>(null);

  const getBranchBadgeColor = (branch: string) => {
    switch (branch.toUpperCase()) {
      case "CSE":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "ECE":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "MECH":
      case "ME":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "CIVIL":
      case "CE":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "EE":
      case "EEE":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const handleSeatClick = async (seat: SeatItem) => {
    setTargetSeatError(null);
    setSwapSuccessMsg(null);

    if (!selectedSeat) {
      // First click: select as source
      setSelectedSeat(seat);
      return;
    }

    if (selectedSeat.allocation_id === seat.allocation_id) {
      // Clicked same seat again: deselect
      setSelectedSeat(null);
      return;
    }

    // Second click: attempt swap
    setIsSwapping(true);
    try {
      const res = await onSwapSeats(selectedSeat.allocation_id, seat.allocation_id);
      if (res.valid) {
        setSwapSuccessMsg(res.reason || "Seats swapped successfully!");
        setSelectedSeat(null);
      } else {
        setTargetSeatError({ id: seat.allocation_id, message: res.reason });
      }
    } catch (err: any) {
      setTargetSeatError({ id: seat.allocation_id, message: err.message || "Swap failed" });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Pane: Room List */}
      <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col h-[700px]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Examination Rooms</h3>
            <p className="text-[11px] text-slate-500">Select room to review benches</p>
          </div>
          <button
            onClick={onRefresh}
            title="Refresh Room Matrix"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 mt-3 space-y-2 pr-1">
          {rooms.map((room) => {
            const isSelected = room.id === selectedRoomId;
            return (
              <div
                key={room.id}
                onClick={() => {
                  setSelectedSeat(null);
                  setTargetSeatError(null);
                  onSelectRoom(room.id);
                }}
                className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                  isSelected
                    ? "bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Room {room.room_number}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {room.rows}×{room.columns} grid
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] opacity-80">
                  <span>{room.bench_count} benches</span>
                  <span>Max {room.exam_capacity} seats</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Pane: Visual Bench Grid */}
      <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-[700px]">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Room {matrixData?.room_number || "Overview"} — Visual Bench Matrix
              </h2>
              {matrixData?.exam_type && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-[#1E3A8A] font-semibold">
                  {matrixData.exam_type}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Click a seat to select it, then click another seat to perform an interactive swap with live branch isolation check.
            </p>
          </div>

          {/* Invigilators Assigned */}
          {matrixData?.invigilators && matrixData.invigilators.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <UserCheck className="w-4 h-4 text-[#1E3A8A]" />
              <div className="text-xs">
                <span className="text-slate-500 font-medium">Invigilation: </span>
                {matrixData.invigilators.map((inv, i) => (
                  <span key={inv.faculty_id} className="font-bold text-slate-800">
                    {inv.name} ({inv.duty_role})
                    {i < matrixData.invigilators.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Swap Action Banner */}
        {selectedSeat && (
          <div className="my-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-[#1E3A8A]">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>
                Selected Source: <strong>{selectedSeat.roll_number}</strong> ({selectedSeat.name} — {selectedSeat.branch}). Click any target seat to test swap.
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedSeat(null);
                setTargetSeatError(null);
              }}
              className="px-2 py-1 bg-white border border-blue-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Swap Success / Error Notifications */}
        {swapSuccessMsg && (
          <div className="my-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{swapSuccessMsg}</span>
          </div>
        )}
        {targetSeatError && (
          <div className="my-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2 animate-bounce">
            <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
            <span>{targetSeatError.message}</span>
          </div>
        )}

        {/* Benches Grid Container */}
        <div className="flex-1 overflow-auto mt-3 p-3 bg-[#F8FAFC] rounded-xl border border-slate-200">
          {!matrixData || matrixData.benches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 text-slate-400">
              <ShieldAlert className="w-12 h-12 mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No Seating Allocated Yet</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Use the Selector Tool tab above to assign branch ranges to this room and execute the seating engine.
              </p>
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${matrixData.columns || 4}, minmax(220px, 1fr))`,
              }}
            >
              {matrixData.benches.map((bench) => {
                const leftSeat = bench.seats.find((s) => s.seat_position === "LEFT" || s.seat_position === "SINGLE");
                const rightSeat = bench.seats.find((s) => s.seat_position === "RIGHT");

                return (
                  <div
                    key={bench.bench_id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 hover:shadow-md transition flex flex-col justify-between"
                  >
                    {/* Bench Header */}
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pb-2 border-b border-slate-100 mb-2">
                      <span>Bench #{bench.bench_number}</span>
                      <span className="text-[10px] text-slate-400">
                        R{bench.row}:C{bench.col}
                      </span>
                    </div>

                    {/* Bench Seats Container */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Left Seat */}
                      {leftSeat ? (
                        <div
                          onClick={() => handleSeatClick(leftSeat)}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition relative ${
                            selectedSeat?.allocation_id === leftSeat.allocation_id
                              ? "ring-2 ring-blue-600 bg-blue-50 border-blue-400"
                              : targetSeatError?.id === leftSeat.allocation_id
                              ? "bg-red-50 border-red-500 animate-pulse ring-2 ring-red-400"
                              : "bg-slate-50 hover:bg-blue-50/50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400">
                              {leftSeat.seat_position === "SINGLE" ? "SOLO" : "L"}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${getBranchBadgeColor(leftSeat.branch)}`}>
                              {leftSeat.branch}
                            </span>
                          </div>
                          <div className="text-xs font-mono font-bold text-slate-900 truncate">
                            {leftSeat.roll_number}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate">{leftSeat.name}</div>
                          {leftSeat.is_backlog && (
                            <span className="inline-block mt-1 text-[9px] font-bold text-red-600 bg-red-100 px-1 rounded">
                              Backlog
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center text-[10px] text-slate-400">
                          Empty
                        </div>
                      )}

                      {/* Right Seat */}
                      {rightSeat ? (
                        <div
                          onClick={() => handleSeatClick(rightSeat)}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition relative ${
                            selectedSeat?.allocation_id === rightSeat.allocation_id
                              ? "ring-2 ring-blue-600 bg-blue-50 border-blue-400"
                              : targetSeatError?.id === rightSeat.allocation_id
                              ? "bg-red-50 border-red-500 animate-pulse ring-2 ring-red-400"
                              : "bg-slate-50 hover:bg-emerald-50/50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400">R</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${getBranchBadgeColor(rightSeat.branch)}`}>
                              {rightSeat.branch}
                            </span>
                          </div>
                          <div className="text-xs font-mono font-bold text-slate-900 truncate">
                            {rightSeat.roll_number}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate">{rightSeat.name}</div>
                          {rightSeat.is_backlog && (
                            <span className="inline-block mt-1 text-[9px] font-bold text-red-600 bg-red-100 px-1 rounded">
                              Backlog
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center text-[10px] text-slate-400">
                          Empty
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useState } from "react";
import { Search, GraduationCap, MapPin, Calendar, Clock, AlertCircle } from "lucide-react";
import { api } from "@/services/api";

export const StudentPortal: React.FC = () => {
  const [rollNumber, setRollNumber] = useState("");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim()) return;

    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await api.lookupStudent(rollNumber.trim());
      setData(res);
    } catch (err: any) {
      setError(err.message || "Student lookup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-blue-100 rounded-2xl mb-3 text-[#1E3A8A]">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Seating Lookup</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your university Roll Number to check your allocated examination seat, bench, and room.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <input
            type="text"
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            placeholder="e.g. CSE-001 or 21CS01"
            className="flex-1 px-4 py-3 text-base font-mono rounded-xl focus:outline-none uppercase"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-[#1E3A8A] text-white font-bold text-sm rounded-xl hover:bg-[#172554] transition flex items-center gap-2 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>{isLoading ? "Searching..." : "Lookup"}</span>
          </button>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Student Details & Schedule Cards */}
      {data && (
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                {data.student.branch} • Semester {data.student.semester}
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">{data.student.name}</h2>
              <p className="text-xs font-mono text-slate-500 mt-0.5">Roll Number: {data.student.roll_number}</p>
            </div>
            {data.student.is_backlog && (
              <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-lg">
                Backlog Candidate
              </span>
            )}
          </div>

          {/* Seating Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Examination Schedule</h3>
            {data.schedules.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                No active exam seating allocated for this student yet.
              </div>
            ) : (
              data.schedules.map((sch: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border-2 border-blue-100 p-6 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-sm font-bold text-[#1E3A8A]">{sch.session_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700">
                      {sch.exam_type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-center">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Date</span>
                      <span className="text-xs font-bold text-slate-800">{sch.exam_date}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Shift</span>
                      <span className="text-xs font-bold text-slate-800">{sch.shift}</span>
                    </div>

                    <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                      <span className="text-[10px] text-blue-500 uppercase font-bold block mb-1">Room</span>
                      <span className="text-lg font-black text-[#1E3A8A]">Room {sch.room_number}</span>
                    </div>

                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-600 uppercase font-bold block mb-1">Bench & Seat</span>
                      <span className="text-lg font-black text-emerald-800">
                        #{sch.bench_number} <span className="text-xs font-normal">({sch.seat_position})</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

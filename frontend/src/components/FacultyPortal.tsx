"use client";

import React, { useState } from "react";
import { UserCheck, Search, Shield, Calendar, Clock, AlertCircle } from "lucide-react";
import { api } from "@/services/api";

export const FacultyPortal: React.FC = () => {
  const [facultyId, setFacultyId] = useState("");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyId.trim()) return;

    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await api.lookupFaculty(facultyId.trim());
      setData(res);
    } catch (err: any) {
      setError(err.message || "Faculty member not found");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-emerald-100 rounded-2xl mb-3 text-emerald-800">
          <UserCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Faculty Invigilation Roster</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your Faculty ID to view your invigilation schedules, assigned examination halls, and duty roles.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <input
            type="text"
            value={facultyId}
            onChange={(e) => setFacultyId(e.target.value)}
            placeholder="e.g. FAC-01 or EMP-102"
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

      {/* Faculty Profile & Assigned Duties */}
      {data && (
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  {data.faculty.department}
                </span>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  {data.faculty.rank} Faculty
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-2">{data.faculty.name}</h2>
              <p className="text-xs font-mono text-slate-500 mt-0.5">Faculty ID: {data.faculty.faculty_id}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Cumulative Duties</span>
              <span className="text-2xl font-black text-[#1E3A8A]">{data.faculty.cumulative_duties}</span>
            </div>
          </div>

          {/* Assigned Duties List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Assigned Invigilations</h3>
            {data.duties.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                No invigilation duties scheduled for this session.
              </div>
            ) : (
              data.duties.map((duty: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border-2 border-emerald-100 p-6 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-sm font-bold text-slate-900">{duty.session_name}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 text-[#1E3A8A]">
                      {duty.duty_role}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Date</span>
                      <span className="text-xs font-bold text-slate-800">{duty.exam_date}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Shift</span>
                      <span className="text-xs font-bold text-slate-800">{duty.shift}</span>
                    </div>

                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-600 uppercase font-bold block mb-1">Room</span>
                      <span className="text-lg font-black text-emerald-800">Room {duty.room_number}</span>
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

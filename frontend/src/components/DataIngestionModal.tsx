"use client";

import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Plus, History, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { AuditLogItem } from "@/types";

interface DataIngestionProps {
  onDataUploaded: () => void;
  auditLogs: AuditLogItem[];
  onRefreshLogs: () => void;
}

export const DataIngestionModal: React.FC<DataIngestionProps> = ({
  onDataUploaded,
  auditLogs,
  onRefreshLogs,
}) => {
  const [activeTab, setActiveTab] = useState<"students" | "faculty" | "rooms" | "session" | "audit">("students");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [resultMsg, setResultMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Session state
  const [sessionName, setSessionName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionShift, setSessionShift] = useState("Morning (09:30 - 12:30)");
  const [sessionExamType, setSessionExamType] = useState<"Midterm" | "Endterm">("Midterm");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "students" | "faculty" | "rooms") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setResultMsg(null);

    try {
      let res;
      if (type === "students") res = await api.uploadStudents(file);
      else if (type === "faculty") res = await api.uploadFaculty(file);
      else res = await api.uploadRooms(file);

      setResultMsg({
        type: "success",
        text: `Successfully ingested ${file.name}: Created ${res.created}, Updated ${res.updated}. Total ${res.total_processed} processed.`,
      });
      onDataUploaded();
    } catch (err: any) {
      setResultMsg({
        type: "error",
        text: err.message || "Failed to upload and parse file",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName || !sessionDate) return;

    setIsUploading(true);
    setResultMsg(null);
    try {
      await api.createSession({
        name: sessionName,
        exam_date: sessionDate,
        shift: sessionShift,
        exam_type: sessionExamType,
      });
      setResultMsg({
        type: "success",
        text: `Exam Session "${sessionName}" created successfully!`,
      });
      setSessionName("");
      onDataUploaded();
    } catch (err: any) {
      setResultMsg({ type: "error", text: err.message || "Failed to create session" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Tab Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap gap-2">
        <button
          onClick={() => { setActiveTab("students"); setResultMsg(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === "students" ? "bg-[#1E3A8A] text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          Upload Students (CSV/Excel)
        </button>
        <button
          onClick={() => { setActiveTab("faculty"); setResultMsg(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === "faculty" ? "bg-[#1E3A8A] text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          Upload Faculty Master
        </button>
        <button
          onClick={() => { setActiveTab("rooms"); setResultMsg(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === "rooms" ? "bg-[#1E3A8A] text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          Upload Room Geometry
        </button>
        <button
          onClick={() => { setActiveTab("session"); setResultMsg(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === "session" ? "bg-[#1E3A8A] text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          + New Exam Session
        </button>
        <button
          onClick={() => { setActiveTab("audit"); setResultMsg(null); onRefreshLogs(); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === "audit" ? "bg-[#1E3A8A] text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          Audit Log Trail
        </button>
      </div>

      <div className="p-6">
        {resultMsg && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              resultMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {resultMsg.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{resultMsg.text}</span>
          </div>
        )}

        {/* Students Upload */}
        {activeTab === "students" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Import Student Registry</h3>
              <p className="text-xs text-slate-500">
                Upload CSV or Excel file containing student records. Required columns: <code>roll_number, name, branch, semester</code>, and optional <code>is_backlog</code>.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-[#1E3A8A] transition bg-slate-50">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-[#1E3A8A] text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-[#172554] transition inline-block">
                  {isUploading ? "Ingesting..." : "Select Students CSV/Excel"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, "students")}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400 mt-2">Accepted formats: .csv, .xlsx, .xls</p>
            </div>
          </div>
        )}

        {/* Faculty Upload */}
        {activeTab === "faculty" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Import Faculty Master</h3>
              <p className="text-xs text-slate-500">
                Upload CSV or Excel containing faculty profiles. Required columns: <code>faculty_id, name, department, rank</code> (Senior/Junior), and optional <code>cumulative_duties</code>.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-[#1E3A8A] transition bg-slate-50">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-[#1E3A8A] text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-[#172554] transition inline-block">
                  {isUploading ? "Ingesting..." : "Select Faculty CSV/Excel"}
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, "faculty")}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400 mt-2">Accepted formats: .csv, .xlsx, .xls</p>
            </div>
          </div>
        )}

        {/* Rooms Upload */}
        {activeTab === "rooms" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Import Room Master & Benches</h3>
              <p className="text-xs text-slate-500">
                Upload CSV or Excel defining room physical dimensions. Required columns: <code>room_number, block, floor, rows, columns</code>. Physical benches will be dynamically mapped.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-[#1E3A8A] transition bg-slate-50">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-[#1E3A8A] text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-[#172554] transition inline-block">
                  {isUploading ? "Ingesting..." : "Select Rooms CSV/Excel"}
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, "rooms")}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400 mt-2">Accepted formats: .csv, .xlsx, .xls</p>
            </div>
          </div>
        )}

        {/* New Session Creation */}
        {activeTab === "session" && (
          <form onSubmit={handleCreateSession} className="space-y-4 max-w-lg">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Define New Examination Session</h3>
              <p className="text-xs text-slate-500">
                Configure exam type (Midterm 100% capacity vs Endterm 50% lock with Senior+Junior invigilators).
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Session Name</label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. Autumn 2026 Endterm Exams"
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Exam Date</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Shift</label>
                <select
                  value={sessionShift}
                  onChange={(e) => setSessionShift(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                >
                  <option value="Morning (09:30 - 12:30)">Morning (09:30 - 12:30)</option>
                  <option value="Afternoon (14:00 - 17:00)">Afternoon (14:00 - 17:00)</option>
                  <option value="Shift 1">Shift 1</option>
                  <option value="Shift 2">Shift 2</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Exam Classification</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`p-3 rounded-lg border cursor-pointer text-xs flex flex-col ${sessionExamType === "Midterm" ? "border-[#1E3A8A] bg-blue-50/50" : "border-slate-200"}`}>
                  <input
                    type="radio"
                    name="exam_type"
                    value="Midterm"
                    checked={sessionExamType === "Midterm"}
                    onChange={() => setSessionExamType("Midterm")}
                    className="sr-only"
                  />
                  <span className="font-bold text-[#1E3A8A]">Midterm Exam</span>
                  <span className="text-[10px] text-slate-500 mt-1">100% capacity, 1 invigilator per room</span>
                </label>

                <label className={`p-3 rounded-lg border cursor-pointer text-xs flex flex-col ${sessionExamType === "Endterm" ? "border-amber-600 bg-amber-50/50" : "border-slate-200"}`}>
                  <input
                    type="radio"
                    name="exam_type"
                    value="Endterm"
                    checked={sessionExamType === "Endterm"}
                    onChange={() => setSessionExamType("Endterm")}
                    className="sr-only"
                  />
                  <span className="font-bold text-amber-700">Endterm Exam</span>
                  <span className="text-[10px] text-slate-500 mt-1">50% capacity lock, Senior + Junior pairing</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2.5 bg-[#1E3A8A] text-white text-xs font-bold rounded-lg shadow-sm hover:bg-[#172554] transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Session</span>
            </button>
          </form>
        )}

        {/* Audit Log Trail */}
        {activeTab === "audit" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">System Audit Trail</h3>
                <p className="text-xs text-slate-500">Immutable log of manual seat overrides and system events.</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400 font-sans">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded font-sans font-semibold bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-800 font-sans">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

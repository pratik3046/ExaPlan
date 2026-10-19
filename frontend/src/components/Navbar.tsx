"use client";

import React from "react";
import { ShieldCheck, UserCheck, Search, Database, LayoutGrid, LogOut, GraduationCap } from "lucide-react";
import { ExamSession } from "@/types";

interface NavbarProps {
  activeTab: "matrix" | "selector" | "data" | "student" | "faculty";
  setActiveTab: (tab: "matrix" | "selector" | "data" | "student" | "faculty") => void;
  sessions: ExamSession[];
  activeSessionId: number | null;
  setActiveSessionId: (id: number) => void;
  user: { username: string; role: string } | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  sessions,
  activeSessionId,
  setActiveSessionId,
  user,
  onLogout,
  onOpenLogin,
}) => {
  const currentSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <header className="sticky top-0 z-50 bg-[#1E3A8A] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/20">
              <GraduationCap className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight flex items-center gap-2">
                ExaPlan
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-700/60 border border-blue-400/30 text-blue-100 font-medium">
                  Engineering Edition
                </span>
              </div>
              <p className="text-[11px] text-blue-200 hidden sm:block">Automated Seating & Invigilation Engine</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                activeTab === "matrix" ? "bg-white/20 text-white shadow-inner" : "text-blue-100 hover:bg-white/10"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Interactive Matrix
            </button>

            <button
              onClick={() => setActiveTab("selector")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                activeTab === "selector" ? "bg-white/20 text-white shadow-inner" : "text-blue-100 hover:bg-white/10"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Selector Tool
            </button>

            <button
              onClick={() => setActiveTab("data")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                activeTab === "data" ? "bg-white/20 text-white shadow-inner" : "text-blue-100 hover:bg-white/10"
              }`}
            >
              <Database className="w-4 h-4" />
              Data Ingestion
            </button>

            <button
              onClick={() => setActiveTab("student")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                activeTab === "student" ? "bg-white/20 text-white shadow-inner" : "text-blue-100 hover:bg-white/10"
              }`}
            >
              <Search className="w-4 h-4" />
              Student Lookup
            </button>

            <button
              onClick={() => setActiveTab("faculty")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
                activeTab === "faculty" ? "bg-white/20 text-white shadow-inner" : "text-blue-100 hover:bg-white/10"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Faculty Roster
            </button>
          </nav>

          {/* Right Controls: Session Picker & User Status */}
          <div className="flex items-center gap-3">
            {sessions.length > 0 && (
              <div className="hidden lg:flex items-center gap-1.5 bg-blue-900/60 px-3 py-1.5 rounded-lg border border-blue-700/50">
                <span className="text-[11px] text-blue-200">Session:</span>
                <select
                  value={activeSessionId || ""}
                  onChange={(e) => setActiveSessionId(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.name} ({s.exam_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold">{user.username}</div>
                  <div className="text-[10px] text-blue-200 uppercase tracking-wider">{user.role}</div>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-md hover:bg-white/10 text-blue-200 hover:text-white transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="px-3 py-1.5 bg-white text-[#1E3A8A] text-xs font-semibold rounded-md shadow-sm hover:bg-blue-50 transition"
              >
                Admin Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto pb-2 gap-1 text-xs border-t border-blue-700/50 pt-2">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-3 py-1.5 rounded whitespace-nowrap ${activeTab === "matrix" ? "bg-white/20 text-white" : "text-blue-200"}`}
          >
            Matrix
          </button>
          <button
            onClick={() => setActiveTab("selector")}
            className={`px-3 py-1.5 rounded whitespace-nowrap ${activeTab === "selector" ? "bg-white/20 text-white" : "text-blue-200"}`}
          >
            Selector
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`px-3 py-1.5 rounded whitespace-nowrap ${activeTab === "data" ? "bg-white/20 text-white" : "text-blue-200"}`}
          >
            Data
          </button>
          <button
            onClick={() => setActiveTab("student")}
            className={`px-3 py-1.5 rounded whitespace-nowrap ${activeTab === "student" ? "bg-white/20 text-white" : "text-blue-200"}`}
          >
            Student
          </button>
          <button
            onClick={() => setActiveTab("faculty")}
            className={`px-3 py-1.5 rounded whitespace-nowrap ${activeTab === "faculty" ? "bg-white/20 text-white" : "text-blue-200"}`}
          >
            Faculty
          </button>
        </div>
      </div>
    </header>
  );
};

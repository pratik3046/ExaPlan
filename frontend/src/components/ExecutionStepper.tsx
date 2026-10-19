"use client";

import React from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export type StepState = "idle" | "validating" | "allocating" | "balancing" | "completed" | "error";

interface ExecutionStepperProps {
  state: StepState;
  errorMessage?: string;
}

export const ExecutionStepper: React.FC<ExecutionStepperProps> = ({ state, errorMessage }) => {
  if (state === "idle") return null;

  const steps = [
    { id: "validating", label: "Validating Constraints & Detached Queues" },
    { id: "allocating", label: "Allocating Benches (Branch Isolation)" },
    { id: "balancing", label: "Balancing Invigilation Workload" },
  ];

  const getStepStatus = (stepId: string) => {
    if (state === "error") return "error";
    if (state === "completed") return "done";

    const order = ["validating", "allocating", "balancing"];
    const currentIndex = order.indexOf(state);
    const stepIndex = order.indexOf(stepId);

    if (stepIndex < currentIndex) return "done";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 transition-all duration-300">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {steps.map((step, idx) => {
          const status = getStepStatus(step.id);
          return (
            <div key={step.id} className="flex items-center gap-3 w-full sm:w-auto">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  status === "done"
                    ? "bg-emerald-500 text-white"
                    : status === "active"
                    ? "bg-[#1E3A8A] text-white animate-pulse"
                    : status === "error"
                    ? "bg-red-500 text-white"
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                {status === "done" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : status === "active" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : status === "error" ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  idx + 1
                )}
              </div>
              <div className="text-xs">
                <p className={`font-semibold ${status === "active" ? "text-[#1E3A8A]" : "text-slate-700"}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-slate-400">
                  {status === "done"
                    ? "Verified"
                    : status === "active"
                    ? "Processing..."
                    : status === "error"
                    ? "Failed"
                    : "Queued"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {state === "error" && errorMessage && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

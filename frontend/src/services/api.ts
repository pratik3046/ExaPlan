const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getAuthHeaders(isJson = true): HeadersInit {
  const headers: HeadersInit = {};
  if (isJson) {
    headers["Content-Type"] = "application/json";
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("exaplan_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

export const api = {
  // Auth
  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Authentication failed");
    }
    return res.json();
  },

  // Admin Data
  async getSessions() {
    const res = await fetch(`${API_BASE}/admin/sessions`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Failed to load sessions");
    return res.json();
  },

  async createSession(data: { name: string; exam_date: string; shift: string; exam_type: string }) {
    const res = await fetch(`${API_BASE}/admin/sessions`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create session");
    return res.json();
  },

  async getRooms() {
    const res = await fetch(`${API_BASE}/admin/rooms`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Failed to load rooms");
    return res.json();
  },

  async getBranches() {
    const res = await fetch(`${API_BASE}/admin/branches`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Failed to load branches");
    return res.json();
  },

  async getFaculty() {
    const res = await fetch(`${API_BASE}/admin/faculty`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Failed to load faculty");
    return res.json();
  },

  async getAuditLogs() {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Failed to load audit logs");
    return res.json();
  },

  // CSV / Excel File Uploads
  async uploadStudents(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/admin/upload-students`, {
      method: "POST",
      headers: getAuthHeaders(false),
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  async uploadFaculty(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/admin/upload-faculty`, {
      method: "POST",
      headers: getAuthHeaders(false),
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  async uploadRooms(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/admin/upload-rooms`, {
      method: "POST",
      headers: getAuthHeaders(false),
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  // Engine Actions
  async generateSeating(payload: {
    session_id: number;
    room_id: number;
    seating_mode: string;
    branch_a: { branch: string; start_roll: string; end_roll: string };
    branch_b?: { branch: string; start_roll: string; end_roll: string };
  }) {
    const res = await fetch(`${API_BASE}/engine/generate-seating`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Seating generation failed" }));
      throw new Error(err.detail || "Seating generation failed");
    }
    return res.json();
  },

  async validateAndSwap(payload: {
    session_id: number;
    allocation_id_1: number;
    allocation_id_2: number;
  }) {
    const res = await fetch(`${API_BASE}/engine/validate-swap`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Swap failed" }));
      throw new Error(err.detail || "Swap failed");
    }
    return res.json();
  },

  async generateInvigilation(payload: { session_id: number; room_ids: number[] }) {
    const res = await fetch(`${API_BASE}/engine/generate-invigilation`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Invigilation allocation failed" }));
      throw new Error(err.detail || "Invigilation allocation failed");
    }
    return res.json();
  },

  async getRoomMatrix(sessionId: number, roomId: number) {
    const res = await fetch(`${API_BASE}/engine/room-matrix/${sessionId}/${roomId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch room matrix");
    return res.json();
  },

  // Lookups (No Auth Required)
  async lookupStudent(rollNumber: string) {
    const res = await fetch(`${API_BASE}/student/lookup/${encodeURIComponent(rollNumber)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Student not found" }));
      throw new Error(err.detail || "Student not found");
    }
    return res.json();
  },

  async lookupFaculty(facultyId: string) {
    const res = await fetch(`${API_BASE}/faculty/schedule/${encodeURIComponent(facultyId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Faculty not found" }));
      throw new Error(err.detail || "Faculty not found");
    }
    return res.json();
  },
};

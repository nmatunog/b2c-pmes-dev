import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";

const apiBase = () => (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const useRest = () => Boolean(apiBase());

/** Nest often returns JSON `{ message: string | string[] }`; surface that in the UI. */
async function parseApiErrorMessage(response) {
  const text = await response.text();
  if (!text?.trim()) return `Request failed (${response.status})`;
  try {
    const j = JSON.parse(text);
    const m = j?.message;
    if (m != null) {
      return Array.isArray(m) ? m.map((x) => String(x)).join("; ") : String(m);
    }
  } catch {
    /* plain text body */
  }
  return text.trim();
}

async function staffLoginRequest(email, password) {
  const response = await fetch(`${apiBase()}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error((await response.text()) || "Staff sign-in failed");
  }
  return response.json();
}

export const PmesService = {
  async saveRecord(db, appId, user, data) {
    if (!useRest() && !user) throw new Error("Auth Required");
    if (useRest()) {
      const response = await fetch(`${apiBase()}/pmes/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          dob: data.dob,
          gender: data.gender,
          score: data.score,
          passed: data.passed,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail?.trim() || `PMES save failed (${response.status})`);
      }
      const row = await response.json();
      return { success: true, id: row.id };
    }
    const pmesRef = collection(db, "artifacts", appId, "public", "data", "pmes_records");
    const docRef = await addDoc(pmesRef, {
      ...data,
      userId: user.uid,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  },

  async saveLoi(db, appId, user, data) {
    if (!useRest() && !user) throw new Error("Auth Required");
    if (useRest()) {
      const email = String(data.email || user?.email || "").trim();
      if (!email) {
        throw new Error("Missing email — sign in again, or reload the page so your account email can load.");
      }
      const capital = typeof data.initialCapital === "string" ? parseFloat(data.initialCapital) : data.initialCapital;
      const response = await fetch(`${apiBase()}/pmes/loi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          address: data.address,
          occupation: data.occupation,
          employer: data.employer ?? "",
          initialCapital: Number.isFinite(capital) ? capital : 0,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      return { success: true, id: "api" };
    }
    const loiRef = collection(db, "artifacts", appId, "public", "data", "loi_records");
    const docRef = await addDoc(loiRef, {
      ...data,
      userId: user.uid,
      submittedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  },

  async findRecord(db, appId, email, dob, user) {
    if (useRest()) {
      const params = new URLSearchParams({ email, dob });
      const response = await fetch(`${apiBase()}/pmes/certificate?${params}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error((await response.text()) || "Certificate lookup failed");
      }
      return response.json();
    }
    if (!user) throw new Error("Auth Required");
    const pmesRef = collection(db, "artifacts", appId, "public", "data", "pmes_records");
    const q = query(pmesRef, where("userId", "==", user.uid));
    const snapshot = await getDocs(q);
    const records = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (record) =>
          record.email?.toLowerCase().trim() === email.toLowerCase().trim() && record.dob === dob,
      );
    return records.find((record) => record.passed) || records[0] || null;
  },

  /**
   * Staff dashboard: PMES master list + role + token for follow-up API calls.
   * @returns {{ records: unknown[], role: 'admin'|'superuser', accessToken: string }}
   */
  async getAllRecords(db, appId, credentials) {
    if (useRest()) {
      if (!credentials?.email?.trim() || credentials.password === undefined || credentials.password === "") {
        throw new Error("Staff email and password required");
      }
      const login = await staffLoginRequest(credentials.email.trim(), credentials.password);
      const accessToken = login.accessToken;
      const role = login.role;
      const response = await fetch(`${apiBase()}/pmes/admin/records`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "Master list failed");
      }
      const records = await response.json();
      return {
        records: Array.isArray(records) ? records : [],
        role,
        accessToken,
      };
    }
    throw new Error("Staff dashboard requires VITE_API_BASE_URL and the Nest API with a database superuser (npm run create-superuser).");
  },

  /**
   * Superuser only: remove a PMES master list row (PmesRecord). Does not delete the participant.
   */
  async deletePmesRecord(accessToken, recordId) {
    if (!useRest()) throw new Error("API required");
    const id = String(recordId ?? "").trim();
    if (!id) throw new Error("Record id required");
    const response = await fetch(`${apiBase()}/pmes/admin/records/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = text?.trim() || `Delete failed (${response.status})`;
      try {
        const j = JSON.parse(text);
        const m = j?.message;
        if (m != null) {
          detail = Array.isArray(m) ? m.map((x) => String(x)).join("; ") : String(m);
        }
      } catch {
        /* keep detail */
      }
      if (response.status === 404 && detail.includes("Cannot DELETE")) {
        throw new Error(
          "The backend on your API port is an old Node process (it does not have the delete route). Stop it and restart: press Ctrl+C in the terminal running the API, then from the repo root run npm run dev. If it still fails, free the port: lsof -nP -iTCP:3000 -sTCP:LISTEN then kill -9 the listed PID(s).",
        );
      }
      throw new Error(detail);
    }
    if (!text?.trim()) return {};
    return JSON.parse(text);
  },

  async listStaffAdmins(accessToken) {
    if (!useRest()) throw new Error("API required");
    const response = await fetch(`${apiBase()}/auth/staff/admins`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Could not load admin accounts");
    }
    return response.json();
  },

  async createStaffAdmin(accessToken, email, password) {
    if (!useRest()) throw new Error("API required");
    const response = await fetch(`${apiBase()}/auth/staff/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Could not create admin");
    }
    return response.json();
  },

  /** Cooperative membership pipeline (PostgreSQL participant row). */
  async fetchMembershipLifecycle(email) {
    if (!useRest() || !String(email || "").trim()) return null;
    const response = await fetch(`${apiBase()}/pmes/membership-lifecycle?email=${encodeURIComponent(String(email).trim())}`);
    if (!response.ok) {
      const t = await response.text();
      throw new Error(t?.trim() || `Membership status failed (${response.status})`);
    }
    return response.json();
  },

  async submitFullProfile({ email, profileJson, sheetFileName, notes }) {
    if (!useRest()) throw new Error("API required");
    const response = await fetch(`${apiBase()}/pmes/full-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, profileJson, sheetFileName, notes }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Full profile submission failed");
    }
    return response.json();
  },

  async fetchMembershipPipeline(accessToken) {
    if (!useRest()) return [];
    const response = await fetch(`${apiBase()}/pmes/admin/membership-pipeline`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Pipeline load failed");
    }
    return response.json();
  },

  async updateParticipantMembership(accessToken, participantId, { initialFeesPaid, boardApproved }) {
    if (!useRest()) throw new Error("API required");
    const response = await fetch(`${apiBase()}/pmes/admin/participant/membership`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ participantId, initialFeesPaid, boardApproved }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Membership update failed");
    }
    return response.json();
  },

  /**
   * Superuser only: delete one participant (all PMES rows + LOI). Removes a membership pipeline row.
   */
  async deleteParticipant(accessToken, participantId) {
    if (!useRest()) throw new Error("API required");
    const id = String(participantId ?? "").trim();
    if (!id) throw new Error("Participant id required");
    const response = await fetch(`${apiBase()}/pmes/admin/participants/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = text?.trim() || `Delete failed (${response.status})`;
      try {
        const j = JSON.parse(text);
        const m = j?.message;
        if (m != null) {
          detail = Array.isArray(m) ? m.map((x) => String(x)).join("; ") : String(m);
        }
      } catch {
        /* keep detail */
      }
      if (response.status === 404 && detail.includes("Cannot DELETE")) {
        throw new Error(
          "The backend on your API port is an old Node process (it does not have participant delete). Restart the API from the repo root (npm run dev) or free port 3000.",
        );
      }
      throw new Error(detail);
    }
    if (!text?.trim()) return {};
    return JSON.parse(text);
  },

  /** Admin: full members registry (search + pagination). */
  async fetchMemberRegistry(accessToken, { q = "", page = 1, pageSize = 50, includeAll = false } = {}) {
    if (!useRest()) throw new Error("API required");
    const params = new URLSearchParams();
    if (String(q || "").trim()) params.set("q", String(q).trim());
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (includeAll) params.set("includeAll", "true");
    const response = await fetch(`${apiBase()}/pmes/admin/member-registry?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Member registry failed");
    }
    return response.json();
  },

  async fetchParticipantAdminDetail(accessToken, participantId) {
    if (!useRest()) throw new Error("API required");
    const response = await fetch(
      `${apiBase()}/pmes/admin/participants/${encodeURIComponent(String(participantId))}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      throw new Error((await response.text()) || "Participant detail failed");
    }
    return response.json();
  },

  /** Public: roster email + DOB match a legacy-imported pioneer pending digital profile. */
  async checkPioneerEligibility(email, dob) {
    if (!useRest()) throw new Error("API required");
    const response = await fetch(`${apiBase()}/pmes/pioneer/check-eligibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(email || "").trim(), dob: String(dob || "").trim() }),
    });
    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }
    return response.json();
  },

  /** Admin: bulk-create legacy pioneer rows (pipeline ends at full membership form). */
  async importLegacyPioneers(accessToken, rows) {
    if (!useRest()) throw new Error("API required");
    const response = await fetch(`${apiBase()}/pmes/admin/import-legacy-pioneers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ rows: Array.isArray(rows) ? rows : [] }),
    });
    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }
    return response.json();
  },
};

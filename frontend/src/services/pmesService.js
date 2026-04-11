import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";

const apiBase = () => (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const useRest = () => Boolean(apiBase());

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
      const capital = typeof data.initialCapital === "string" ? parseFloat(data.initialCapital) : data.initialCapital;
      const response = await fetch(`${apiBase()}/pmes/loi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          address: data.address,
          occupation: data.occupation,
          employer: data.employer ?? "",
          initialCapital: Number.isFinite(capital) ? capital : 0,
        }),
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "LOI save failed");
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

  async submitFullProfile({ email, fields, sheetFileName, notes }) {
    if (!useRest()) throw new Error("API required");
    const response = await fetch(`${apiBase()}/pmes/full-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fields, sheetFileName, notes }),
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
};

import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";

const apiBase = () => (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const useRest = () => Boolean(apiBase());

export const PmesService = {
  async saveRecord(db, appId, user, data) {
    if (!user) throw new Error("Auth Required");
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
        throw new Error((await response.text()) || "PMES save failed");
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
    if (!user) throw new Error("Auth Required");
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

  async findRecord(db, appId, email, dob) {
    if (useRest()) {
      const params = new URLSearchParams({ email, dob });
      const response = await fetch(`${apiBase()}/pmes/certificate?${params}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error((await response.text()) || "Certificate lookup failed");
      }
      return response.json();
    }
    const pmesRef = collection(db, "artifacts", appId, "public", "data", "pmes_records");
    const snapshot = await getDocs(pmesRef);
    const records = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (record) =>
          record.email?.toLowerCase().trim() === email.toLowerCase().trim() && record.dob === dob,
      );
    return records.find((record) => record.passed) || records[0] || null;
  },

  async getAllRecords(db, appId, adminCode) {
    if (useRest()) {
      if (!adminCode?.trim()) throw new Error("Admin code required");
      const response = await fetch(`${apiBase()}/pmes/admin/records`, {
        headers: { "x-admin-code": adminCode.trim() },
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "Admin list failed");
      }
      return response.json();
    }
    const pmesRef = collection(db, "artifacts", appId, "public", "data", "pmes_records");
    const snapshot = await getDocs(pmesRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },
};

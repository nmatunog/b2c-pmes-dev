"use client";

import { useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

function getFirebaseApp() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId) {
    return null;
  }
  return getApps().length ? getApps()[0] : initializeApp(config);
}

export default function Home() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState("");

  /**
   * Runs after Firebase Email/Password sign-up succeeds: persists uid/email/fullName to Neon via Edge API.
   */
  async function handleAuth(userCredential) {
    const user = userCredential.user;
    const token = await user.getIdToken();
    const res = await fetch("/auth/sync-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email ?? "",
        fullName: fullName.trim(),
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `Sync failed (${res.status})`);
    }
    setStatus("Signed up and synced to Postgres.");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("");
    const app = getFirebaseApp();
    if (!app) {
      setStatus("Set NEXT_PUBLIC_FIREBASE_* env vars (see frontend/.env.example naming).");
      return;
    }
    try {
      const auth = getAuth(app);
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await handleAuth(cred);
      } else {
        let loginEmail = email.trim();
        if (!loginEmail.includes("@")) {
          const resolved = await fetch(
            `/api/pmes/member/resolve-login-email?login=${encodeURIComponent(loginEmail)}`,
          );
          if (resolved.status === 404) {
            throw new Error("No account found for that login.");
          }
          if (!resolved.ok) {
            throw new Error(`Login lookup failed (${resolved.status})`);
          }
          const json = await resolved.json();
          if (!json?.email) {
            throw new Error("No email mapped for this login.");
          }
          loginEmail = String(json.email).trim();
        }
        await signInWithEmailAndPassword(auth, loginEmail.toLowerCase(), password);
        setStatus("Signed in successfully.");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign-in / sign-up failed");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "40rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 800 }}>B2C PMES — Next.js (Edge API)</h1>
      <p style={{ marginTop: "1rem", lineHeight: 1.5 }}>
        Member UI for production lives in <code>frontend/</code>. This page demonstrates Firebase sign-up +{" "}
        <code>POST /auth/sync-member</code> (rewrites to <code>/api/auth/sync-member</code>; Neon{" "}
        <code>Participant</code> row per CURSOR_DOCS.md).
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Demo auth</h2>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button type="button" onClick={() => setMode("signin")} disabled={mode === "signin"}>
            Sign in
          </button>
          <button type="button" onClick={() => setMode("signup")} disabled={mode === "signup"}>
            Sign up
          </button>
        </div>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem", maxWidth: "22rem" }}>
          {mode === "signup" ? (
            <label>
              Full name
              <input
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                autoComplete="name"
                required
              />
            </label>
          ) : null}
          <label>
            {mode === "signup" ? "Email" : "Email, callsign, or member ID"}
            <input
              type={mode === "signup" ? "email" : "text"}
              style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              autoComplete={mode === "signup" ? "email" : "username"}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
            />
          </label>
          <button type="submit">{mode === "signup" ? "Sign up & sync member" : "Sign in"}</button>
        </form>
        {status ? (
          <p style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }} role="status">
            {status}
          </p>
        ) : null}
      </section>
    </main>
  );
}

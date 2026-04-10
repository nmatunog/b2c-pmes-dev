import { useCallback, useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  AlertCircle,
  Briefcase,
  Check,
  CheckCircle2,
  Coins,
  FileText,
  House,
  Loader2,
  LogIn,
  Lock,
  Mail,
  Printer,
  ShieldAlert,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { modules } from "./constants/modules";
import { questionPool } from "./constants/questionPool";
import { CourseAudioPreference, readCourseAudioPreference, writeCourseAudioPreference } from "./components/CourseAudioPreference";
import { NarrativeCard } from "./components/NarrativeCard";
import { Certificate } from "./components/Certificate";
import { LOIForm } from "./components/LOIForm";
import { pcmToWav, preloadAudioUrl } from "./lib/audio";
import { auth, db, appId, isFirebaseConfigured } from "./services/firebase";
import { PmesService } from "./services/pmesService";
import { clearPmesProgress, loadPmesProgress, savePmesProgress } from "./services/pmesProgressService";
import { requestTts } from "./services/ttsApi";
import { globalStyles } from "./styles/globalStyles";
import { PRIVACY_AGREEMENT_PARAGRAPHS } from "./constants/privacyAgreement";
import LandingPage from "./landingpage/landing.jsx";
import { IdentityBanner } from "./components/IdentityBanner.jsx";

/**
 * Gemini prebuilt voices (lively / energetic family): Sadachbia = lively, Zephyr = bright,
 * Puck = upbeat, Fenrir = excitable, Laomedeia = upbeat. OpenAI/Grok map unknown names server-side.
 */
const VOICE = "Sadachbia";
/** Bump when backend TTS output meaningfully changes — avoids replaying stale blob URLs from an old build. */
const TTS_CLIENT_CACHE_BUST = "3";

const RESUMABLE_APP_STATES = new Set([
  "consent",
  "registration",
  "seminar",
  "exam",
  "result",
  "certificate",
  "loi_form",
]);

/** PMES and related flows: never render without a Firebase sign-in (guarded below). */
const MEMBER_AUTH_REQUIRED_STATES = new Set([
  "consent",
  "registration",
  "seminar",
  "exam",
  "result",
  "certificate",
  "loi_form",
  "payment_portal",
]);

/** Full name, DOB, email, gender — needed for PMES record, certificate, and LOI. */
function isParticipantProfileComplete(fd) {
  if (!fd || typeof fd !== "object") return false;
  return Boolean(
    String(fd.fullName || "").trim() && fd.dob && String(fd.email || "").trim() && fd.gender,
  );
}

function mapFirebaseAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try logging in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Use at least 6 characters for your password.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Something went wrong. Check your connection and try again.";
  }
}

function formatTtsError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("500") || raw.includes("Gemini TTS failed")) {
    return "Voice could not be generated. Restart the API server after saving backend/.env, or check GEMINI_API_KEY and AI_PROVIDER.";
  }
  if (raw.length > 180) {
    return `${raw.slice(0, 180)}…`;
  }
  return raw;
}

export default function App() {
  const [appState, setAppState] = useState("landing");
  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const [authReady, setAuthReady] = useState(false);
  const [signUp, setSignUp] = useState({ email: "", password: "", confirm: "" });
  const [logIn, setLogIn] = useState({ email: "", password: "" });
  /** Single screen for member sign-in vs register */
  const [memberAuthMode, setMemberAuthMode] = useState(/** @type {"signup" | "login"} */ ("login"));
  /** Staff email after successful admin dashboard login (for identity ribbon). */
  const [staffSessionEmail, setStaffSessionEmail] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const hydratingRef = useRef(false);
  /** Last PMES flow screen (consent, seminar, …) — used for resume snapshot + landing “Continue PMES”. Starts null until user enters a resumable step or progress loads. */
  const lastFlowAppStateRef = useRef(/** @type {string | null} */ (null));
  /** Where `registration` was opened from: exam gate, member portal, or default (legacy → seminar). */
  const registrationNavRef = useRef(/** @type {"exam" | "portal" | "menu"} */ ("menu"));
  /** After email/password auth, jump to this PMES screen (e.g. user tapped Start PMES before signing in). */
  const pendingAfterAuthRef = useRef(/** @type {'consent' | 'retrieval' | null} */ (null));
  const [formData, setFormData] = useState({ fullName: "", gender: "", email: "", phone: "", dob: "" });
  const [loiData, setLoiData] = useState({ address: "", occupation: "", employer: "", initialCapital: "", agreement: false });
  const [retrievalData, setRetrievalData] = useState({ email: "", dob: "" });
  const [adminCreds, setAdminCreds] = useState({ email: "", password: "" });
  /** Staff JWT role after admin dashboard login; token kept in memory only. */
  const [staffRole, setStaffRole] = useState(/** @type {null | "admin" | "superuser"} */ (null));
  const [staffAccessToken, setStaffAccessToken] = useState(null);
  const [managedStaffAdmins, setManagedStaffAdmins] = useState([]);
  const [newStaffAdmin, setNewStaffAdmin] = useState({ email: "", password: "" });
  const [staffAdminError, setStaffAdminError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [openCardIndex, setOpenCardIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  /** Which narrative card key (`index-title`) is fetching/buffering audio — avoids disabling every card. */
  const [loadingTtsKey, setLoadingTtsKey] = useState(null);
  /** Which section is currently playing TTS (for per-card Pause in the header). */
  const [speakingTtsKey, setSpeakingTtsKey] = useState(null);
  const [ttsError, setTtsError] = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);
  const [masterList, setMasterList] = useState([]);
  const [examQuestions, setExamQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [courseAudioEnabled, setCourseAudioEnabledState] = useState(readCourseAudioPreference);
  /** True when the member left PMES for the marketing home but has not finished the flow (resume later). */
  const [pmesPaused, setPmesPaused] = useState(false);
  const audioCache = useRef({});
  const inflightTts = useRef({});
  const currentAudio = useRef(null);

  const ensureTtsUrl = useCallback(async (text, cacheKey) => {
    const cacheId = `${VOICE}::${TTS_CLIENT_CACHE_BUST}::${cacheKey}`;
    const hit = audioCache.current[cacheId];
    if (hit) return hit;
    const pending = inflightTts.current[cacheId];
    if (pending) return pending;

    const p = (async () => {
      try {
        const result = await requestTts({ text, voice: VOICE });
        const base64 = result?.audioBase64;
        const encoding = result?.encoding ?? "pcm16";
        if (!base64) throw new Error("No TTS data");
        let wavUrl;
        if (encoding === "mp3") {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          wavUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        } else {
          const pcm = new Int16Array(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer);
          wavUrl = URL.createObjectURL(pcmToWav(pcm));
        }
        audioCache.current[cacheId] = wavUrl;
        return wavUrl;
      } finally {
        delete inflightTts.current[cacheId];
      }
    })();

    inflightTts.current[cacheId] = p;
    return p;
  }, [VOICE]);

  const prefetchTts = useCallback(
    (text, cacheKey) => {
      void ensureTtsUrl(text, cacheKey).catch(() => null);
    },
    [ensureTtsUrl],
  );

  const applyLoadedProgress = useCallback((prog) => {
    if (!prog || typeof prog !== "object") return;
    if (prog.formData && typeof prog.formData === "object") {
      setFormData((prev) => ({ ...prev, ...prog.formData }));
    }
    if (prog.loiData && typeof prog.loiData === "object") {
      setLoiData((prev) => ({ ...prev, ...prog.loiData }));
    }
    if (prog.retrievalData && typeof prog.retrievalData === "object") {
      setRetrievalData((prev) => ({ ...prev, ...prog.retrievalData }));
    }
    if (typeof prog.currentStep === "number") setCurrentStep(prog.currentStep);
    if (typeof prog.openCardIndex === "number") setOpenCardIndex(prog.openCardIndex);
    if (Array.isArray(prog.examQuestions)) setExamQuestions(prog.examQuestions);
    if (prog.answers && typeof prog.answers === "object") setAnswers(prog.answers);
    if (typeof prog.score === "number") setScore(prog.score);
    if (prog.activeRecord && typeof prog.activeRecord === "object") setActiveRecord(prog.activeRecord);
    if (typeof prog.courseAudioEnabled === "boolean") setCourseAudioEnabledState(prog.courseAudioEnabled);
    if (typeof prog.pmesPaused === "boolean") setPmesPaused(prog.pmesPaused);
    if (typeof prog.appState === "string" && RESUMABLE_APP_STATES.has(prog.appState)) {
      lastFlowAppStateRef.current = prog.appState;
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      if (import.meta.env.DEV) {
        console.info(
          "[PMES] Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in frontend/.env for Email/Password auth and Firestore.",
        );
      }
      setAuthReady(true);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        hydratingRef.current = false;
        setPmesPaused(false);
        lastFlowAppStateRef.current = null;
        setAppState("landing");
        setAuthReady(true);
        return;
      }

      hydratingRef.current = true;

      const pending = pendingAfterAuthRef.current;
      if (pending === "consent") {
        pendingAfterAuthRef.current = null;
        applyLoadedProgress({
          formData: {
            fullName: "",
            gender: "",
            email: u.email || "",
            phone: "",
            dob: "",
          },
        });
        setPmesPaused(false);
        setAppState("consent");
        hydratingRef.current = false;
        setAuthReady(true);
        return;
      }
      if (pending === "retrieval") {
        pendingAfterAuthRef.current = null;
        setRetrievalData((d) => ({ ...d, email: u.email || d.email }));
        setPmesPaused(false);
        setAppState("login_retrieval");
        hydratingRef.current = false;
        setAuthReady(true);
        return;
      }

      try {
        const prog = await loadPmesProgress(db, appId, u.uid);
        if (prog && typeof prog === "object") {
          applyLoadedProgress(prog);
          const saved = prog.appState;
          if (prog.pmesPaused && typeof saved === "string" && RESUMABLE_APP_STATES.has(saved)) {
            setAppState("landing");
          } else if (typeof saved === "string") {
            if (saved === "login_retrieval") {
              setAppState("login_retrieval");
            } else if (saved === "landing") {
              setAppState("landing");
            } else if (saved === "payment_portal") {
              setAppState("payment_portal");
            } else if (RESUMABLE_APP_STATES.has(saved)) {
              if (saved === "registration" && isParticipantProfileComplete(prog.formData)) {
                setAppState("seminar");
              } else {
                setAppState(saved);
              }
            }
          }
        } else if (appStateRef.current === "login" || appStateRef.current === "member_auth") {
          setAppState("landing");
        }
      } catch {
        if (appStateRef.current === "login" || appStateRef.current === "member_auth") {
          setAppState("landing");
        }
      } finally {
        hydratingRef.current = false;
        setAuthReady(true);
      }
    });

    return unsub;
  }, [applyLoadedProgress]);

  useEffect(() => {
    if (appState === "loi_success") {
      lastFlowAppStateRef.current = null;
      return;
    }
    if (RESUMABLE_APP_STATES.has(appState)) {
      lastFlowAppStateRef.current = appState;
    }
  }, [appState]);

  useEffect(() => {
    if (!authReady || !user || !isFirebaseConfigured) return undefined;
    if (hydratingRef.current) return undefined;
    if (appState === "member_auth" || appState === "admin_login" || appState === "admin_dashboard") return undefined;

    const persistStates = new Set([...RESUMABLE_APP_STATES, "landing", "login_retrieval", "payment_portal"]);
    if (!persistStates.has(appState)) return undefined;

    const id = window.setTimeout(() => {
      if (hydratingRef.current) return;
      const effectiveAppState =
        appState === "landing"
          ? pmesPaused
            ? lastFlowAppStateRef.current || "seminar"
            : lastFlowAppStateRef.current || "landing"
          : appState;
      const snapshot = {
        appState: effectiveAppState,
        pmesPaused: appState === "landing" ? pmesPaused : false,
        currentStep,
        openCardIndex,
        formData,
        loiData,
        retrievalData,
        examQuestions,
        answers,
        score,
        activeRecord,
        courseAudioEnabled,
        accountEmail: user.email || null,
      };
      void savePmesProgress(db, appId, user.uid, snapshot);
    }, 700);
    return () => window.clearTimeout(id);
  }, [
    authReady,
    user,
    appState,
    currentStep,
    openCardIndex,
    formData,
    loiData,
    retrievalData,
    examQuestions,
    answers,
    score,
    activeRecord,
    courseAudioEnabled,
    pmesPaused,
  ]);

  useEffect(() => {
    if (appState !== "registration" || !user?.email) return;
    setFormData((prev) => ({ ...prev, email: user.email || prev.email }));
  }, [appState, user]);

  useEffect(() => {
    if (!ttsError) return undefined;
    const id = setTimeout(() => setTtsError(null), 12000);
    return () => clearTimeout(id);
  }, [ttsError]);

  const setCourseAudioEnabled = (enabled) => {
    if (!enabled) {
      currentAudio.current?.pause();
      setIsSpeaking(false);
      setSpeakingTtsKey(null);
    }
    setCourseAudioEnabledState(enabled);
    writeCourseAudioPreference(enabled);
  };

  const pauseTts = useCallback(() => {
    currentAudio.current?.pause();
    setIsSpeaking(false);
    setSpeakingTtsKey(null);
  }, []);

  const playTts = async (text, cacheKey) => {
    if (isSpeaking) {
      pauseTts();
      return;
    }
    setTtsError(null);
    setLoadingTtsKey(cacheKey);
    try {
      const wavUrl = await ensureTtsUrl(text, cacheKey);
      const audio = await preloadAudioUrl(wavUrl);
      currentAudio.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        setSpeakingTtsKey(null);
      };
      setSpeakingTtsKey(cacheKey);
      setIsSpeaking(true);
      await audio.play();
    } catch (err) {
      setTtsError(formatTtsError(err));
      setIsSpeaking(false);
      setSpeakingTtsKey(null);
    } finally {
      setLoadingTtsKey(null);
    }
  };

  const handleFinishExam = async () => {
    setLoading(true);
    setError(null);
    const correct = examQuestions.reduce((sum, question, index) => sum + Number(answers[index] === question.c), 0);
    setScore(correct);
    try {
      const saved = await PmesService.saveRecord(db, appId, user, { ...formData, score: correct, passed: correct >= 7 });
      const recordId = saved?.id;
      setActiveRecord({
        ...formData,
        score: correct,
        id: recordId ?? `local-${Date.now()}`,
        passed: correct >= 7,
        timestamp: new Date().toISOString(),
      });
      setAppState("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Check all fields and API connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoiSubmit = async () => {
    if (!loiData.address || !loiData.occupation || !loiData.initialCapital || !loiData.agreement) {
      setError("Please complete all fields.");
      return;
    }
    setLoading(true);
    try {
      await PmesService.saveLoi(db, appId, user, { ...formData, ...loiData, pmesRecordId: activeRecord.id });
      setAppState("loi_success");
    } catch {
      setError("Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminPortal = () => {
    setError(null);
    setAdminCreds({ email: "", password: "" });
    setStaffRole(null);
    setStaffAccessToken(null);
    setStaffSessionEmail(null);
    setManagedStaffAdmins([]);
    setNewStaffAdmin({ email: "", password: "" });
    setStaffAdminError(null);
    setAppState("admin_login");
  };

  const handleAdminLoginSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    const useApi = Boolean((import.meta.env.VITE_API_BASE_URL || "").trim());
    if (!useApi) {
      setError("Set VITE_API_BASE_URL (e.g. http://localhost:3000) in frontend/.env for admin sign-in.");
      return;
    }
    setLoading(true);
    try {
      const result = await PmesService.getAllRecords(db, appId, adminCreds);
      setMasterList(result.records);
      setStaffRole(result.role);
      setStaffAccessToken(result.accessToken);
      setStaffSessionEmail(adminCreds.email.trim());
      if (result.role === "superuser") {
        try {
          const admins = await PmesService.listStaffAdmins(result.accessToken);
          setManagedStaffAdmins(Array.isArray(admins) ? admins : []);
        } catch {
          setManagedStaffAdmins([]);
        }
      } else {
        setManagedStaffAdmins([]);
      }
      setAppState("admin_dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Admin sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaffAdminSubmit = async (event) => {
    event.preventDefault();
    if (!staffAccessToken || staffRole !== "superuser") return;
    setStaffAdminError(null);
    if (!newStaffAdmin.email?.trim() || (newStaffAdmin.password?.length ?? 0) < 8) {
      setStaffAdminError("Enter an email and a password of at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await PmesService.createStaffAdmin(staffAccessToken, newStaffAdmin.email.trim(), newStaffAdmin.password);
      setNewStaffAdmin({ email: "", password: "" });
      const admins = await PmesService.listStaffAdmins(staffAccessToken);
      setManagedStaffAdmins(Array.isArray(admins) ? admins : []);
    } catch (e) {
      setStaffAdminError(e instanceof Error ? e.message : "Could not create admin.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieval = async () => {
    setLoading(true);
    setError(null);
    const useApi = Boolean((import.meta.env.VITE_API_BASE_URL || "").trim());
    if (!useApi && !user) {
      setError("Sign in with your member email and password, then try again.");
      setLoading(false);
      return;
    }
    try {
      const record = await PmesService.findRecord(db, appId, retrievalData.email, retrievalData.dob, user);
      if (record?.passed) {
        setActiveRecord(record);
        setAppState("certificate");
      } else {
        setError(record ? "Passing record not found." : "Record not found.");
      }
    } catch {
      setError("Lookup failed. Check connection or try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    setPmesPaused(false);
    setAppState("landing");
  };

  const switchMemberAuthMode = (mode) => {
    if (mode === "signup" && logIn.email.trim()) {
      setSignUp((s) => ({ ...s, email: logIn.email }));
    }
    if (mode === "login" && signUp.email.trim()) {
      setLogIn((l) => ({ ...l, email: signUp.email }));
    }
    setMemberAuthMode(mode);
    setError(null);
  };

  const handleSignUpSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!isFirebaseConfigured) {
      setError("Firebase is not configured. Add VITE_FIREBASE_* keys in frontend/.env.");
      return;
    }
    const email = signUp.email.trim();
    if (!email || !signUp.password) {
      setError("Email and password are required.");
      return;
    }
    if (signUp.password !== signUp.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, signUp.password);
      setFormData((prev) => ({ ...prev, email }));
      setLogIn({ email, password: "" });
      setPmesPaused(false);
      setAppState("consent");
    } catch (err) {
      setError(mapFirebaseAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!isFirebaseConfigured) {
      setError("Firebase is not configured.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, logIn.email.trim(), logIn.password);
    } catch (err) {
      setError(mapFirebaseAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = logIn.email.trim();
    if (!email) {
      setError("Enter your email above, then tap Forgot password again.");
      return;
    }
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setError(null);
      alert("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(mapFirebaseAuthError(err?.code));
    }
  };

  const goHomeFromPmes = () => {
    setPmesPaused(true);
    setAppState("landing");
  };

  const continuePmesFromLanding = () => {
    if (!user) return;
    hydratingRef.current = true;
    setPmesPaused(false);
    void loadPmesProgress(db, appId, user.uid).then((prog) => {
      if (prog?.appState && RESUMABLE_APP_STATES.has(prog.appState)) {
        applyLoadedProgress({ ...prog, pmesPaused: false });
        let next = prog.appState;
        if (next === "registration" && isParticipantProfileComplete(prog.formData)) {
          next = "seminar";
        }
        setAppState(next);
      } else {
        setAppState(lastFlowAppStateRef.current || "seminar");
      }
      hydratingRef.current = false;
    });
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <Loader2 className="h-12 w-12 animate-spin text-[#004aad]" aria-hidden />
      </div>
    );
  }

  /** `auth.currentUser` covers the brief window after sign-up before React `user` state updates. */
  const sessionUser = isFirebaseConfigured ? user ?? auth.currentUser : null;

  const staffForBanner =
    staffSessionEmail && staffRole && appState === "admin_dashboard"
      ? { email: staffSessionEmail, role: staffRole }
      : null;
  const memberIdentityForBanner =
    user && appState !== "member_auth" && !staffForBanner
      ? {
          fullName: String(formData.fullName || "").trim() || "Member",
          email: user.email || String(formData.email || "").trim() || "",
        }
      : null;
  const identityRibbon = <IdentityBanner member={memberIdentityForBanner} staff={staffForBanner} />;

  if (isFirebaseConfigured && !sessionUser && MEMBER_AUTH_REQUIRED_STATES.has(appState)) {
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen flex-col lg:flex-row">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <aside className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#004aad] via-[#003d8f] to-slate-900 px-8 py-12 text-white lg:w-[44%] lg:min-h-screen lg:shrink-0 lg:py-16 lg:pl-12 lg:pr-10 xl:pl-16">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-16 left-10 h-48 w-48 rounded-full bg-blue-400/20 blur-2xl" aria-hidden />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">B2C PMES</p>
            <h1 className="mt-4 max-w-md text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[2.35rem] lg:leading-[1.15]">
              Continue your membership journey
            </h1>
            <p className="mt-4 max-w-sm text-base font-medium leading-relaxed text-white/85">
              Sign in or create one account for the seminar, exam, and digital certificate.
            </p>
            <ul className="mt-8 max-w-sm space-y-3 text-sm font-semibold text-white/90">
              <li className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                Privacy notice, then interactive modules
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                Assessment &amp; certificate in one place
              </li>
            </ul>
          </aside>
          <div className="flex flex-1 items-center justify-center bg-slate-100/90 px-5 py-10 sm:px-10 lg:bg-[#f1f5f9] lg:py-12">
            <div className="w-full max-w-lg rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-900/5 sm:p-10 sm:rounded-[2.25rem]">
              <div className="text-center lg:text-left">
                <p className="text-xs font-black uppercase tracking-widest text-[#004aad]/80">Member access</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Continue to PMES</h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                  Use the same email and password you&apos;ll use for certificates and member tools.
                </p>
              </div>
              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMemberAuthMode("login");
                    setAppState("member_auth");
                  }}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base font-black sm:py-5 sm:text-lg"
                >
                  <LogIn className="h-5 w-5 shrink-0" aria-hidden />
                  Sign in or create account
                </button>
                <button
                  type="button"
                  onClick={() => setAppState("landing")}
                  className="w-full rounded-2xl py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#004aad]"
                >
                  Back to home
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (appState === "member_auth") {
    const isSignup = memberAuthMode === "signup";
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen flex-col lg:flex-row">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <aside className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#004aad] via-[#003d8f] to-slate-900 px-8 py-10 text-white sm:py-14 lg:w-[44%] lg:min-h-screen lg:shrink-0 lg:py-16 lg:pl-12 lg:pr-10 xl:pl-16">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-blue-400/15 blur-2xl" aria-hidden />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">Member account</p>
            <h1 className="mt-4 max-w-lg text-3xl font-black leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.5rem] xl:text-[2.75rem]">
              {isSignup ? "Create your cooperative login" : "Welcome back, member"}
            </h1>
            <p className="mt-5 max-w-md text-base font-medium leading-relaxed text-white/88 sm:text-lg">
              {isSignup
                ? "One account for PMES modules, your exam, and your certificate. Next: privacy notice, then the seminar."
                : "Pick up where you left off — modules, exam, certificate, or Letter of Intent."}
            </p>
            <ul className="mt-8 hidden max-w-md space-y-3 text-sm font-semibold leading-snug text-white/90 sm:block">
              <li className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                Secure sign-in with email &amp; password
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                Progress saved so you can resume anytime
              </li>
            </ul>
          </aside>
          <div className="flex flex-1 items-center justify-center bg-slate-100/90 px-4 py-10 sm:px-8 lg:bg-[#f1f5f9] lg:py-12">
            <form
              onSubmit={isSignup ? handleSignUpSubmit : handleLoginSubmit}
              className="w-full max-w-xl rounded-[1.75rem] border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-900/[0.06] sm:rounded-[2rem] sm:p-9 lg:max-w-[32rem] lg:p-10"
            >
              <div className="text-center lg:text-left">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#004aad]/10 text-[#004aad] lg:mx-0 lg:mb-5 lg:h-14 lg:w-14">
                  {isSignup ? <UserPlus className="h-7 w-7" aria-hidden /> : <LogIn className="h-7 w-7" aria-hidden />}
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-[#004aad]/80">
                  {isSignup ? "New registration" : "Sign in"}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  {isSignup ? "Create your login" : "Enter your credentials"}
                </h2>
              </div>
              <div className="mt-8 flex gap-2 rounded-2xl bg-slate-100 p-1.5">
                <button
                  type="button"
                  onClick={() => switchMemberAuthMode("login")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition-all ${
                    !isSignup ? "bg-white text-[#004aad] shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <LogIn className="h-4 w-4 shrink-0" aria-hidden />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMemberAuthMode("signup")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition-all ${
                    isSignup ? "bg-white text-[#004aad] shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                  Register
                </button>
              </div>
              {error && (
                <div
                  className={`mt-6 rounded-2xl p-4 text-center text-sm font-bold sm:text-base ${isSignup ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-900"}`}
                >
                  {error}
                </div>
              )}
              <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type="email"
                    autoComplete="email"
                    className="input-field !py-[1.1rem] !pl-12 !text-base sm:!text-lg"
                    placeholder="Email address"
                    value={isSignup ? signUp.email : logIn.email}
                    onChange={(e) =>
                      isSignup
                        ? setSignUp((s) => ({ ...s, email: e.target.value }))
                        : setLogIn((l) => ({ ...l, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    className="input-field !py-[1.1rem] !pl-12 !text-base sm:!text-lg"
                    placeholder={isSignup ? "Password (6+ characters)" : "Password"}
                    value={isSignup ? signUp.password : logIn.password}
                    onChange={(e) =>
                      isSignup
                        ? setSignUp((s) => ({ ...s, password: e.target.value }))
                        : setLogIn((l) => ({ ...l, password: e.target.value }))
                    }
                    required
                    minLength={6}
                  />
                </div>
                {isSignup ? (
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="input-field !py-[1.1rem] !pl-12 !text-base sm:!text-lg"
                      placeholder="Confirm password"
                      value={signUp.confirm}
                      onChange={(e) => setSignUp((s) => ({ ...s, confirm: e.target.value }))}
                      required
                      minLength={6}
                    />
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-8 flex w-full items-center justify-center gap-2 !py-4 text-base font-black sm:!py-5 sm:text-lg"
              >
                {loading ? <Loader2 className="animate-spin" /> : null}
                {isSignup ? "Create account & continue" : "Sign in"}
              </button>
              {!isSignup ? (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="mt-4 w-full text-sm font-bold text-slate-500 hover:text-[#004aad]"
                >
                  Forgot password?
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setAppState("landing")}
                className="mt-6 w-full rounded-2xl py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#004aad]"
              >
                Back to home
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  /** Show “Continue PMES” on the marketing home when paused mid-flow or any unfinished resumable step is saved. */
  const resumePmesSuggested =
    Boolean(user) &&
    (pmesPaused ||
      Boolean(lastFlowAppStateRef.current && RESUMABLE_APP_STATES.has(lastFlowAppStateRef.current)));

  const pmesExamPassed = Boolean(
    user && ((typeof score === "number" && score >= 7) || activeRecord?.passed === true),
  );

  if (appState === "landing")
    return (
      <>
        {identityRibbon}
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <LandingPage
          isFirebaseConfigured={isFirebaseConfigured}
          authUser={user}
          resumePmesSuggested={resumePmesSuggested}
          pmesExamPassed={pmesExamPassed}
          onJoinUs={() => {
            if (!isFirebaseConfigured) return;
            if (user) {
              setPmesPaused(false);
              setAppState("consent");
              return;
            }
            setMemberAuthMode("signup");
            setAppState("member_auth");
          }}
          onLogin={() => {
            setMemberAuthMode("login");
            setAppState("member_auth");
          }}
          onLogout={handleLogout}
          onContinuePmes={user && resumePmesSuggested ? continuePmesFromLanding : undefined}
          onStartPmes={() => {
            if (!isFirebaseConfigured) return;
            if (user) {
              setPmesPaused(false);
              setAppState("consent");
              return;
            }
            pendingAfterAuthRef.current = "consent";
            setMemberAuthMode("login");
            setAppState("member_auth");
          }}
          onRetrieveCertificate={() => {
            if (!isFirebaseConfigured) return;
            if (user) {
              setRetrievalData((d) => ({ ...d, email: user.email || d.email }));
              setPmesPaused(false);
              setAppState("login_retrieval");
              return;
            }
            pendingAfterAuthRef.current = "retrieval";
            setMemberAuthMode("login");
            setAppState("member_auth");
          }}
          onAdminPortal={handleAdminPortal}
          onMemberProfile={() => {
            if (!user) return;
            registrationNavRef.current = "portal";
            setAppState("registration");
          }}
          onOpenLoi={() => {
            if (!isFirebaseConfigured || !user) return;
            setPmesPaused(false);
            setAppState("loi_form");
          }}
          onOpenPayment={() => {
            if (!isFirebaseConfigured || !user) return;
            setPmesPaused(false);
            setAppState("payment_portal");
          }}
        />
      </>
    );

  if (appState === "seminar")
    return (
      <>
        {identityRibbon}
        <div className="min-h-screen px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl md:rounded-[2.5rem] lg:rounded-[3rem]">
          <div className="flex flex-col gap-4 bg-[#004aad] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:p-10">
            <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-6">
              {(() => {
                const Icon = modules[currentStep].icon;
                return <Icon className="h-11 w-11 shrink-0 md:h-14 md:w-14" aria-hidden />;
              })()}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Current module</p>
                <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl lg:text-4xl">
                  {modules[currentStep].title}
                </h2>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 self-start sm:self-auto">
              <button
                type="button"
                onClick={goHomeFromPmes}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
              >
                <House className="h-4 w-4 shrink-0" aria-hidden />
                Save &amp; home
              </button>
              <div className="rounded-full bg-black/20 px-4 py-2 text-lg font-bold tabular-nums md:px-6 md:text-xl">
                {currentStep + 1} / {modules.length}
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-10 md:space-y-8 md:p-12 lg:p-14">
            <CourseAudioPreference enabled={courseAudioEnabled} onChange={setCourseAudioEnabled} />
            {ttsError && (
              <div
                className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
                role="alert"
              >
                <span className="min-w-0 leading-snug">{ttsError}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-xl bg-white/80 px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-white"
                  onClick={() => setTtsError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}
            {modules[currentStep].items.map((item, index) => (
              <NarrativeCard
                key={item.t}
                index={index}
                title={item.t}
                outline={item.outline}
                script={item.script}
                illustration={item.illustration}
                isOpen={openCardIndex === index}
                onClick={() => setOpenCardIndex(index)}
                courseAudioEnabled={courseAudioEnabled}
                onCourseAudioChange={setCourseAudioEnabled}
                prefetchTts={prefetchTts}
                playTts={playTts}
                pauseTts={pauseTts}
                isSpeaking={isSpeaking}
                speakingTtsKey={speakingTtsKey}
                audioLoading={loadingTtsKey === `${index}-${item.t}`}
              />
            ))}
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/80 p-6 sm:flex-row sm:gap-6 sm:p-10 md:p-12">
            <button
              type="button"
              disabled={currentStep === 0}
              onClick={() => {
                setCurrentStep((step) => step - 1);
                setOpenCardIndex(0);
                currentAudio.current?.pause();
                setIsSpeaking(false);
              }}
              className={`flex-1 rounded-2xl py-5 text-lg font-bold tracking-tight transition-colors md:rounded-3xl md:py-8 md:text-2xl ${
                currentStep === 0 ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-white text-slate-800 shadow-md hover:bg-slate-50"
              }`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                currentAudio.current?.pause();
                setIsSpeaking(false);
                if (currentStep < modules.length - 1) {
                  setCurrentStep((step) => step + 1);
                  setOpenCardIndex(0);
                } else {
                  const questions = [...questionPool].sort(() => 0.5 - Math.random()).slice(0, 10);
                  if (!isParticipantProfileComplete(formData)) {
                    setExamQuestions(questions);
                    registrationNavRef.current = "exam";
                    setAppState("registration");
                    return;
                  }
                  setExamQuestions(questions);
                  setAppState("exam");
                }
              }}
              className="btn-primary flex-[2] rounded-2xl py-5 text-lg font-bold tracking-tight md:rounded-3xl md:py-8 md:text-2xl"
            >
              {currentStep === modules.length - 1 ? "Go to exam" : "Next"}
            </button>
          </div>
        </div>
      </div>
      </>
    );

  if (appState === "exam")
    return (
      <>
        {identityRibbon}
        <div className="min-h-screen px-8 py-16">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto mb-10 flex max-w-5xl justify-end">
          <button
            type="button"
            onClick={goHomeFromPmes}
            className="btn-secondary inline-flex items-center gap-2 py-3 text-lg font-bold"
          >
            <House className="h-5 w-5" aria-hidden />
            Save &amp; home
          </button>
        </div>
        <div className="mx-auto w-full max-w-5xl space-y-16 rounded-[4rem] bg-white p-16 shadow-2xl">
          <h2 className="text-center text-6xl font-black uppercase tracking-tighter text-[#004aad]">FINAL CHALLENGE</h2>
          <div className="space-y-16">
            {examQuestions.map((question, index) => (
              <div key={question.q} className="space-y-10 rounded-[4rem] border-4 border-slate-200 bg-slate-50 p-12 shadow-inner">
                <h3 className="flex gap-6 text-4xl font-black text-slate-800"><span className="text-[#004aad]">{index + 1}.</span>{question.q}</h3>
                <div className="grid grid-cols-1 gap-6">
                  {question.a.map((option, optionIndex) => (
                    <button
                      key={option}
                      onClick={() => setAnswers({ ...answers, [index]: optionIndex })}
                      className={`rounded-[2.5rem] border-8 p-10 text-left text-3xl font-black transition-all ${
                        answers[index] === optionIndex
                          ? "scale-[1.03] border-[#004aad] bg-[#004aad] text-white shadow-2xl"
                          : "border-slate-100 bg-white text-slate-700"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error && (
            <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-6 text-center text-lg font-bold text-red-800">{error}</div>
          )}
          <button onClick={handleFinishExam} disabled={loading} className="btn-primary h-32 w-full text-4xl font-black uppercase tracking-tighter">
            {loading ? <Loader2 className="animate-spin" /> : "SUBMIT EXAM"}
          </button>
        </div>
      </div>
      </>
    );

  if (appState === "result")
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-10 text-center">
          <div className={`mx-auto flex h-40 w-40 items-center justify-center rounded-full border-[12px] sm:h-48 sm:w-48 ${score >= 7 ? "bg-emerald-100 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
            {score >= 7 ? <CheckCircle2 className="h-20 w-20 sm:h-24 sm:w-24" /> : <AlertCircle className="h-20 w-20 sm:h-24 sm:w-24" />}
          </div>
          {score >= 7 ? (
            <>
              <h1 className="text-5xl font-black uppercase tracking-tighter text-[#004aad] sm:text-6xl">Well done!</h1>
              <p className="text-2xl font-bold leading-relaxed text-slate-700 sm:text-3xl">
                You scored <span className="tabular-nums text-[#004aad]">{score} out of 10</span> — you have passed the PMES assessment.
              </p>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
                Your result has been saved. Next, open your certificate. After that, you can complete the{" "}
                <strong>Letter of Intent</strong> from the certificate screen whenever you are ready.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-5xl font-black uppercase tracking-tighter text-[#004aad] sm:text-6xl">Keep going!</h1>
              <p className="text-2xl font-bold leading-relaxed text-slate-700 sm:text-3xl">
                You scored <span className="tabular-nums text-[#004aad]">{score} out of 10</span>. You need at least 7 to pass.
              </p>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
                Review the modules and try the exam again when you feel ready — many members pass on their next attempt.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => setAppState(score >= 7 ? "certificate" : "seminar")}
            className="btn-primary py-10 text-3xl uppercase tracking-tighter sm:py-12 sm:text-4xl"
          >
            {score >= 7 ? "View certificate" : "Back to seminar & re-take"}
          </button>
        </div>
      </div>
      </>
    );

  if (appState === "certificate")
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen flex-col items-center bg-slate-100 p-8 sm:p-20">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        {!activeRecord?.fullName ? (
          <div className="card-senior w-full max-w-lg space-y-8 text-center">
            <p className="text-xl font-bold text-slate-700">Certificate data is missing. Complete the exam with a passing score, or retrieve your record from “My Certificate.”</p>
            <button type="button" onClick={() => setAppState("landing")} className="btn-primary w-full py-6">
              Back to home
            </button>
          </div>
        ) : (
          <>
            <Certificate record={activeRecord} />
            <div className="no-print mt-16 flex w-full max-w-4xl flex-col gap-8 sm:flex-row">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary flex-1 py-8 text-2xl uppercase tracking-tighter"
              >
                <Printer aria-hidden />
                Print / Save as PDF
              </button>
              <button type="button" onClick={() => setAppState("loi_form")} className="btn-primary flex-1 py-8 text-2xl uppercase tracking-tighter">
                <Briefcase aria-hidden />
                Letter of Intent
              </button>
              <button type="button" onClick={goHomeFromPmes} className="btn-secondary flex-1 py-8 text-lg font-bold">
                Home
              </button>
            </div>
          </>
        )}
      </div>
      </>
    );

  if (appState === "loi_form")
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-12">
          <h1 className="text-center text-5xl font-black uppercase tracking-tighter text-[#004aad]">LETTER OF INTENT</h1>
          <LOIForm
            formData={formData}
            loiData={loiData}
            setLoiData={setLoiData}
            error={error}
            loading={loading}
            onSubmit={handleLoiSubmit}
            onBack={() => setAppState("certificate")}
          />
        </div>
      </div>
      </>
    );

  if (appState === "loi_success")
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-10 border-emerald-100 text-center">
          <Sparkles className="mx-auto h-32 w-32 animate-pulse text-emerald-500" />
          <h1 className="text-6xl font-black uppercase tracking-tighter text-[#004aad]">THANK YOU!</h1>
          <button
            type="button"
            onClick={async () => {
              if (user && isFirebaseConfigured) {
                try {
                  await clearPmesProgress(db, appId, user.uid);
                } catch {
                  /* ignore */
                }
              }
              setPmesPaused(false);
              setAppState("landing");
            }}
            className="btn-primary w-full py-10 text-3xl"
          >
            FINISH
          </button>
        </div>
      </div>
      </>
    );

  if (appState === "payment_portal")
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-2xl space-y-8 text-center">
          <Coins className="mx-auto h-16 w-16 text-[#004aad]" aria-hidden />
          <h1 className="text-3xl font-black uppercase tracking-tighter text-[#004aad] md:text-4xl">Share capital &amp; membership</h1>
          <p className="text-lg font-medium leading-relaxed text-slate-600">
            Use your branch&apos;s official payment instructions to pay share capital and the annual membership fee. Connect your
            live payment portal here when the cooperative provides the integration or external link.
          </p>
          <button type="button" onClick={() => setAppState("landing")} className="btn-primary w-full py-5 text-xl font-black">
            Back to home
          </button>
        </div>
      </div>
      </>
    );

  if (appState === "login_retrieval")
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <div className="card-senior w-full max-w-2xl space-y-10">
            <h2 className="text-center text-4xl font-black uppercase tracking-tighter text-[#004aad]">RETRIEVE CERTIFICATE</h2>
            <div className="space-y-6">
              <input type="email" placeholder="Email Address" className="input-field" value={retrievalData.email} onChange={(event) => setRetrievalData({ ...retrievalData, email: event.target.value })} />
              <input type="date" className="input-field" value={retrievalData.dob} onChange={(event) => setRetrievalData({ ...retrievalData, dob: event.target.value })} />
              {error && <div className="rounded-2xl bg-red-50 p-6 font-bold text-red-600">{error}</div>}
              <button onClick={handleRetrieval} disabled={loading} className="btn-primary w-full">
                SEARCH
              </button>
            </div>
          </div>
        </div>
      </>
    );

  if (appState === "consent")
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-8">
          <div className="text-center">
            <ShieldAlert className="mx-auto h-20 w-20 animate-bounce text-[#004aad]" />
            <h1 className="mt-4 text-4xl font-black uppercase tracking-tighter text-[#004aad] sm:text-5xl">Privacy &amp; data notice</h1>
            <p className="mt-3 text-lg font-semibold text-slate-600">Please read the following before continuing.</p>
          </div>
          <div
            className="max-h-[min(28rem,55vh)] space-y-4 overflow-y-auto rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-left text-lg leading-relaxed text-slate-700 shadow-inner"
            role="region"
            aria-label="Privacy agreement text"
          >
            {PRIVACY_AGREEMENT_PARAGRAPHS.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({ ...prev, email: user?.email || prev.email }));
              setAppState("seminar");
            }}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            <Lock className="h-6 w-6 shrink-0" />
            I AGREE AND CONTINUE
          </button>
        </div>
      </div>
      </>
    );

  if (appState === "registration") {
    const regNav = registrationNavRef.current;
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-3xl space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-[#004aad] sm:text-5xl">Member profile</h1>
            <p className="mt-3 text-lg font-semibold text-slate-600">
              Used for your PMES record, certificate, LOI, and retrieval. Sign-up already captured your login email.
            </p>
            {regNav === "exam" ? (
              <p className="mt-2 text-sm font-bold text-amber-800">Complete these details to continue to the exam.</p>
            ) : null}
          </div>
          <div className="space-y-8">
            {error && <div className="rounded-2xl bg-red-50 p-4 text-center font-bold text-red-600">{error}</div>}
            <input type="text" className="input-field" placeholder="Full Name (First Name MI. Last Name)" value={formData.fullName} onChange={(event) => setFormData({ ...formData, fullName: event.target.value })} />
            <div className="grid grid-cols-2 gap-6">
              <input type="date" className="input-field" value={formData.dob} onChange={(event) => setFormData({ ...formData, dob: event.target.value })} />
              <select className="input-field" value={formData.gender} onChange={(event) => setFormData({ ...formData, gender: event.target.value })}>
                <option value="">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <input
              type="email"
              className="input-field"
              placeholder="Email Address"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              readOnly={Boolean(user?.email)}
              title={user?.email ? "Email is tied to your member login." : undefined}
            />
            <input type="tel" className="input-field" placeholder="Phone Number" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
            <button
              type="button"
              onClick={() => {
                if (!formData.fullName || !formData.dob || !formData.email || !formData.gender) {
                  setError("Fill all fields including gender.");
                  return;
                }
                setError(null);
                const from = registrationNavRef.current;
                registrationNavRef.current = "menu";
                if (from === "exam") {
                  setAppState("exam");
                } else if (from === "portal") {
                  setAppState("landing");
                } else {
                  setAppState("seminar");
                }
              }}
              className="btn-primary w-full py-6 text-2xl font-black uppercase tracking-tighter sm:py-8 sm:text-3xl"
            >
              {regNav === "exam" ? "Continue to exam" : regNav === "portal" ? "Save & return home" : "Save & continue"}
            </button>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  const from = registrationNavRef.current;
                  registrationNavRef.current = "menu";
                  setAppState(from === "exam" ? "seminar" : "landing");
                }}
                className="text-sm font-bold text-slate-500 hover:text-[#004aad]"
              >
                {regNav === "exam" ? "Back to modules" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (appState === "admin_login")
    return (
      <>
        {identityRibbon}
        <div className="flex min-h-screen items-center justify-center bg-[#004aad]/5 p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <form onSubmit={handleAdminLoginSubmit} className="card-senior w-full max-w-md space-y-8">
          <div className="text-center">
            <Briefcase className="mx-auto h-14 w-14 text-[#004aad]" aria-hidden />
            <p className="text-xs font-black uppercase tracking-widest text-[#004aad]/80">Staff access</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-tighter text-[#004aad] sm:text-4xl">Admin sign in</h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-slate-600">
              Superuser and admin accounts live in the API database. Create the bootstrap superuser once with{" "}
              <code className="rounded bg-slate-100 px-1 text-sm">npm run create-superuser</code> in{" "}
              <code className="rounded bg-slate-100 px-1 text-sm">backend/</code>. Admins are created by the superuser from
              the dashboard.
            </p>
          </div>
          {error && <div className="rounded-2xl bg-amber-50 p-4 text-center font-bold text-amber-900">{error}</div>}
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" aria-hidden />
            <input
              type="email"
              autoComplete="username"
              className="input-field pl-12"
              placeholder="Admin email"
              value={adminCreds.email}
              onChange={(e) => setAdminCreds((c) => ({ ...c, email: e.target.value }))}
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" aria-hidden />
            <input
              type="password"
              autoComplete="current-password"
              className="input-field pl-12"
              placeholder="Password"
              value={adminCreds.password}
              onChange={(e) => setAdminCreds((c) => ({ ...c, password: e.target.value }))}
              required
              minLength={6}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-5 text-lg sm:text-xl">
            {loading ? <Loader2 className="animate-spin" /> : null}
            Open master list
          </button>
          <button type="button" onClick={() => setAppState("landing")} className="w-full font-bold text-slate-500 hover:text-[#004aad]">
            Back to home
          </button>
        </form>
      </div>
      </>
    );

  if (appState === "admin_dashboard")
    return (
      <>
        {identityRibbon}
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8 lg:p-12">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-white shadow-xl lg:rounded-[2.5rem]">
          <div className="flex flex-col gap-6 bg-[#004aad] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="flex items-center gap-4">
              <img src="/b2c-logo.png" alt="" className="h-14 w-auto object-contain sm:h-16" width={80} height={64} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Admin</p>
                <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">PMES master list</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMasterList([]);
                setAdminCreds({ email: "", password: "" });
                setStaffRole(null);
                setStaffAccessToken(null);
                setStaffSessionEmail(null);
                setManagedStaffAdmins([]);
                setNewStaffAdmin({ email: "", password: "" });
                setStaffAdminError(null);
                setAppState("landing");
              }}
              className="shrink-0 rounded-xl bg-white/20 px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-white/30"
            >
              Logout
            </button>
          </div>
          {staffRole === "superuser" ? (
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-8 lg:px-10">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Admin accounts</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Only you (superuser) can add staff admins. They can open this master list but cannot create other accounts.
              </p>
              {staffAdminError ? (
                <div className="mt-4 rounded-2xl bg-red-50 p-4 text-center text-sm font-bold text-red-800">{staffAdminError}</div>
              ) : null}
              <form onSubmit={handleCreateStaffAdminSubmit} className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500" htmlFor="new-admin-email">
                    New admin email
                  </label>
                  <input
                    id="new-admin-email"
                    type="email"
                    autoComplete="off"
                    className="input-field w-full"
                    placeholder="colleague@example.com"
                    value={newStaffAdmin.email}
                    onChange={(e) => setNewStaffAdmin((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500" htmlFor="new-admin-password">
                    Temporary password
                  </label>
                  <input
                    id="new-admin-password"
                    type="password"
                    autoComplete="new-password"
                    className="input-field w-full"
                    placeholder="Min. 8 characters"
                    value={newStaffAdmin.password}
                    onChange={(e) => setNewStaffAdmin((s) => ({ ...s, password: e.target.value }))}
                    minLength={8}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-8 py-4 font-black lg:self-stretch"
                >
                  <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
                  Create admin
                </button>
              </form>
              {managedStaffAdmins.length > 0 ? (
                <ul className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                  {managedStaffAdmins.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span className="font-bold text-slate-900">{a.email}</span>
                      <span className="text-xs font-bold uppercase text-slate-400">{a.role}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 text-sm font-medium text-slate-500">No admin accounts yet — add one above.</p>
              )}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="p-4 lg:p-5">Participant</th>
                  <th className="p-4 lg:p-5">Email / Phone</th>
                  <th className="p-4 lg:p-5">Date &amp; time</th>
                  <th className="p-4 lg:p-5">Score</th>
                  <th className="p-4 lg:p-5">Status</th>
                  <th className="p-4 lg:p-5 text-center">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {masterList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-lg font-semibold text-slate-500">
                      No records loaded. Sign in again from Admin portal or check the API.
                    </td>
                  </tr>
                ) : (
                  masterList.map((item) => {
                    const raw = item.timestamp;
                    const d = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
                    const tsLabel = d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-PH") : "—";
                    return (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/90">
                        <td className="p-4 align-top lg:p-5">
                          <p className="font-black text-slate-900">{item.fullName}</p>
                          <p className="text-xs text-slate-500">DOB: {item.dob || "—"}</p>
                        </td>
                        <td className="p-4 align-top text-slate-600 lg:p-5">
                          <p className="break-all">{item.email}</p>
                          <p className="text-slate-500">{item.phone || "—"}</p>
                        </td>
                        <td className="p-4 align-top text-slate-700 lg:p-5">
                          <span className="whitespace-nowrap text-xs sm:text-sm">{tsLabel}</span>
                        </td>
                        <td className="p-4 align-top font-black tabular-nums text-slate-900 lg:p-5">
                          {item.score ?? "—"}/10
                        </td>
                        <td className="p-4 align-top lg:p-5">
                          {item.passed ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-800">
                              Passed
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-900">
                              Not passed
                            </span>
                          )}
                        </td>
                        <td className="p-4 align-top text-center lg:p-5">
                          {item.passed ? (
                            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRecord(item);
                                  setAppState("certificate");
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#004aad]/10 px-3 py-2 text-xs font-bold uppercase text-[#004aad] hover:bg-[#004aad]/20"
                              >
                                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRecord(item);
                                  setAppState("certificate");
                                  setTimeout(() => window.print(), 600);
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50"
                              >
                                <Printer className="h-4 w-4 shrink-0" aria-hidden />
                                Print
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </>
    );

  return null;
}

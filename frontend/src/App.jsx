import { useCallback, useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  AlertCircle,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Eye,
  FileText,
  HeartHandshake,
  IdCard,
  House,
  Loader2,
  LogIn,
  Lock,
  Mail,
  MapPin,
  Phone,
  Printer,
  Search,
  ShieldAlert,
  Trash2,
  Sparkles,
  User,
  UserPlus,
} from "lucide-react";
import { queueSignupLiveActivityFromDevice } from "./lib/signupLiveActivity.js";
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
import { syncMemberToPostgres } from "./services/memberSyncService.js";
import { requestTts } from "./services/ttsApi";
import { globalStyles } from "./styles/globalStyles";
import {
  PRIVACY_NOTICE_HEADING,
  PRIVACY_NOTICE_PARAGRAPHS,
  PRIVACY_PMES_CONSENT_CLOSING,
} from "./constants/privacyAgreement";
import LandingPage from "./landingpage/landing.jsx";
import { IdentityBanner } from "./components/IdentityBanner.jsx";
import { MessengerPaymentQr, MESSENGER_PAYMENT_CHAT_URL } from "./components/MessengerPaymentQr.jsx";
import { PortalHomeBar } from "./components/PortalHomeBar.jsx";
import { B2CLogo } from "./components/B2CLogo.jsx";
import { ReferralEngine } from "./components/ReferralEngine.jsx";
import { MemberLifecyclePortal } from "./components/MemberLifecyclePortal.jsx";
import { PIONEER_POINTS_PER_JOIN } from "./lib/referralTiers.js";
import { derivePmesIntent } from "./lib/pmesIntent.js";
import {
  getJoinPipelineBanner,
  planJoinNavigation,
  shouldHidePmesEntry,
} from "./lib/joinJourney.js";
import { resolveMemberPortalAccess } from "./lib/membershipAccess.js";

/**
 * Gemini prebuilt voices (lively / energetic family): Sadachbia = lively, Zephyr = bright,
 * Puck = upbeat, Fenrir = excitable, Laomedeia = upbeat. OpenAI/Grok map unknown names server-side.
 */
const VOICE = "Sadachbia";
/** Bump when backend TTS output meaningfully changes — avoids replaying stale blob URLs from an old build. */
const TTS_CLIENT_CACHE_BUST = "3";
const REGISTRY_PAGE_SIZE = 50;

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
  "member_portal",
  "member_pending",
  "seminar",
  "exam",
  "result",
  "certificate",
  "loi_form",
  "payment_portal",
]);

/** Join name parts for certificates, API `fullName`, and Firebase displayName. */
function composeFullName(first, middle, last) {
  return [first, middle, last]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function escapeHtmlForPrint(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Opens a print dialog with the current registry rows (browser can Save as PDF). */
function printMemberRegistryTable(rows, title = "Member registry") {
  const w = window.open("", "_blank");
  if (!w) return;
  const header =
    "<tr><th>Name</th><th>Email</th><th>Phone</th><th>DOB</th><th>Mailing address</th><th>Civil status</th><th>Member ID</th></tr>";
  const body = (rows || [])
    .map((r) => {
      const x = /** @type {Record<string, unknown>} */ (r);
      return `<tr><td>${escapeHtmlForPrint(x.fullName)}</td><td>${escapeHtmlForPrint(x.email)}</td><td>${escapeHtmlForPrint(x.phone)}</td><td>${escapeHtmlForPrint(x.dob)}</td><td>${escapeHtmlForPrint(x.mailingAddress)}</td><td>${escapeHtmlForPrint(x.civilStatus)}</td><td>${escapeHtmlForPrint(x.memberIdNo)}</td></tr>`;
    })
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtmlForPrint(title)}</title><style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:20px;color:#0f172a;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #cbd5e1;padding:8px 10px;font-size:11px;vertical-align:top;}th{background:#f1f5f9;font-weight:700;text-align:left;}h1{font-size:18px;margin:0 0 16px;}</style></head><body><h1>${escapeHtmlForPrint(title)}</h1><table><thead>${header}</thead><tbody>${body || '<tr><td colspan="7">No rows</td></tr>'}</tbody></table></body></html>`;
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    w.print();
    w.close();
  };
}

/** Identity ribbon: show first + last only (no middle name). */
function displayNameFirstLast(formData, activeRecordFullName, authDisplayName) {
  const fn = String(formData?.firstName || "").trim();
  const ln = String(formData?.lastName || "").trim();
  if (fn && ln) return `${fn} ${ln}`;
  const fromFull = (s) => {
    const t = String(s || "").trim();
    if (!t) return "";
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };
  return (
    fromFull(formData?.fullName) ||
    fromFull(activeRecordFullName) ||
    fromFull(authDisplayName) ||
    ""
  );
}

/**
 * Profile: name (composed or legacy single fullName), DOB, email, gender, phone — for PMES / exam gate.
 * Residence is required when first+last name were captured (new sign-up); older saves may only have `fullName`.
 */
function isParticipantProfileComplete(fd) {
  if (!fd || typeof fd !== "object") return false;
  const nameOk =
    String(fd.fullName || "").trim() ||
    (String(fd.firstName || "").trim() && String(fd.lastName || "").trim());
  if (!nameOk || !fd.dob || !String(fd.email || "").trim() || !fd.gender || !String(fd.phone || "").trim()) {
    return false;
  }
  const hasResidence = String(fd.residenceAddress || "").trim();
  const splitNames = Boolean(String(fd.firstName || "").trim() && String(fd.lastName || "").trim());
  if (splitNames) return Boolean(hasResidence);
  return true;
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
  const [signUp, setSignUp] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    dob: "",
    residenceAddress: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [logIn, setLogIn] = useState({ email: "", password: "" });
  /** Single screen for member sign-in vs register */
  const [memberAuthMode, setMemberAuthMode] = useState(/** @type {"signup" | "login"} */ ("login"));
  /** Staff email after successful admin dashboard login (for identity ribbon). */
  const [staffSessionEmail, setStaffSessionEmail] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const hydratingRef = useRef(false);
  /** Last uid we ran Postgres sync for inside this auth listener (avoids double fire when sign-up also calls sync). */
  const memberSyncOncePerUidRef = useRef(/** @type {string | null} */ (null));
  /** Last PMES flow screen (consent, seminar, …) — used for resume snapshot + landing “Continue PMES”. Starts null until user enters a resumable step or progress loads. */
  const lastFlowAppStateRef = useRef(/** @type {string | null} */ (null));
  /** Where `registration` was opened from: exam gate, member portal, or default (legacy → seminar). */
  const registrationNavRef = useRef(/** @type {"exam" | "portal" | "menu"} */ ("menu"));
  /** After email/password auth: certificate retrieval or pioneer reclaim — not the unified join path. */
  const pendingAfterAuthRef = useRef(/** @type {'retrieval' | 'pioneer_portal' | null} */ (null));
  /** After guest taps Join / Start PMES, run unified join navigation once logged in. */
  const pendingPostAuthUnifiedJoinRef = useRef(false);
  const [formData, setFormData] = useState({
    fullName: "",
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    email: "",
    phone: "",
    dob: "",
    residenceAddress: "",
  });
  const [loiData, setLoiData] = useState({ address: "", occupation: "", employer: "", initialCapital: "", agreement: false });
  const [retrievalData, setRetrievalData] = useState({ email: "", dob: "" });
  const [pioneerReclaimEmail, setPioneerReclaimEmail] = useState("");
  const [pioneerReclaimDob, setPioneerReclaimDob] = useState("");
  const [pioneerReclaimLoading, setPioneerReclaimLoading] = useState(false);
  const [pioneerReclaimError, setPioneerReclaimError] = useState(null);
  const [pioneerReclaimEligible, setPioneerReclaimEligible] = useState(/** @type {boolean | null} */ (null));
  const [legacyImportJson, setLegacyImportJson] = useState(
    '[\n  { "email": "member@example.com", "fullName": "Juan Dela Cruz", "phone": "+639171234567", "dob": "1985-06-15", "gender": "Male" }\n]',
  );
  const [legacyImportMsg, setLegacyImportMsg] = useState(null);
  const [legacyImportLoading, setLegacyImportLoading] = useState(false);
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
  /** While a superuser delete request is in flight (row id). */
  const [deletingMasterListId, setDeletingMasterListId] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [courseAudioEnabled, setCourseAudioEnabledState] = useState(readCourseAudioPreference);
  /** True when the member left PMES for the marketing home but has not finished the flow (resume later). */
  const [pmesPaused, setPmesPaused] = useState(false);
  /** Pioneer referral stats — wire to API when joins are tracked server-side. */
  const [pioneerReferral] = useState(() => ({ successfulJoinCount: 0, invitesThisMonth: 0 }));
  /** PostgreSQL membership pipeline when `VITE_API_BASE_URL` is set */
  const [membershipLifecycle, setMembershipLifecycle] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipPipeline, setMembershipPipeline] = useState(/** @type {unknown[]} */ ([]));
  /** Admin member registry (full membership submissions) */
  const [registryRows, setRegistryRows] = useState(/** @type {unknown[]} */ ([]));
  const [registryTotal, setRegistryTotal] = useState(0);
  const [registryPage, setRegistryPage] = useState(1);
  const [registrySearchInput, setRegistrySearchInput] = useState("");
  const [registryAppliedSearch, setRegistryAppliedSearch] = useState("");
  const [registryIncludeAll, setRegistryIncludeAll] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryDetail, setRegistryDetail] = useState(/** @type {Record<string, unknown> | null} */ (null));
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
        memberSyncOncePerUidRef.current = null;
        hydratingRef.current = false;
        setPmesPaused(false);
        lastFlowAppStateRef.current = null;
        setAppState("landing");
        setAuthReady(true);
        return;
      }

      if (import.meta.env.VITE_API_BASE_URL?.trim()) {
        const sid = u.uid;
        if (memberSyncOncePerUidRef.current !== sid) {
          memberSyncOncePerUidRef.current = sid;
          void syncMemberToPostgres(u, u.displayName?.trim() || undefined);
        }
      }

      hydratingRef.current = true;

      const pending = pendingAfterAuthRef.current;
      if (pending === "retrieval") {
        pendingAfterAuthRef.current = null;
        setRetrievalData((d) => ({ ...d, email: u.email || d.email }));
        setPmesPaused(false);
        setAppState("login_retrieval");
        hydratingRef.current = false;
        setAuthReady(true);
        return;
      }
      if (pending === "pioneer_portal") {
        pendingAfterAuthRef.current = null;
        setPmesPaused(false);
        hydratingRef.current = false;
        setAuthReady(true);
        setAppState("member_pending");
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

  /** After pioneer reclaim, prefill member auth email/DOB from sessionStorage. */
  useEffect(() => {
    if (appState !== "member_auth") return;
    try {
      const raw = sessionStorage.getItem("b2c_pioneer_prefill");
      if (!raw) return;
      const p = JSON.parse(raw);
      sessionStorage.removeItem("b2c_pioneer_prefill");
      const email = typeof p.email === "string" ? p.email.trim() : "";
      const dob = typeof p.dob === "string" ? p.dob.trim() : "";
      if (email) {
        setSignUp((s) => ({ ...s, email }));
        setLogIn((l) => ({ ...l, email }));
      }
      if (dob) setSignUp((s) => ({ ...s, dob }));
    } catch {
      /* ignore */
    }
  }, [appState]);

  /** LOI header shows formData name/email — fill gaps when opening from member portal (user may skip registration PMES form). */
  useEffect(() => {
    if (appState !== "loi_form" || !user) return;
    setFormData((prev) => {
      let email = String(prev.email || "").trim();
      if (!email && user.email) email = user.email;

      let fullName = String(prev.fullName || "").trim();
      if (!fullName) {
        const fromParts = composeFullName(prev.firstName, prev.middleName, prev.lastName);
        if (fromParts) fullName = fromParts;
      }
      if (!fullName && activeRecord?.fullName) fullName = String(activeRecord.fullName).trim();
      if (!fullName && user.displayName) fullName = String(user.displayName).trim();

      if (email === String(prev.email || "").trim() && fullName === String(prev.fullName || "").trim()) return prev;
      return { ...prev, email, fullName };
    });
  }, [appState, user, activeRecord]);

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

  const refreshMembershipLifecycle = useCallback(async () => {
    const api = (import.meta.env.VITE_API_BASE_URL || "").trim();
    if (!api || !user?.email) {
      setMembershipLifecycle(null);
      return null;
    }
    setMembershipLoading(true);
    try {
      const row = await PmesService.fetchMembershipLifecycle(user.email);
      setMembershipLifecycle(row);
      return row;
    } catch {
      const err = { stage: "UNKNOWN", canAccessFullMemberPortal: false };
      setMembershipLifecycle(err);
      return err;
    } finally {
      setMembershipLoading(false);
    }
  }, [user?.email]);

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
      if ((import.meta.env.VITE_API_BASE_URL || "").trim()) {
        void refreshMembershipLifecycle();
      }
      setAppState("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Check all fields and API connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady || !user?.email || !(import.meta.env.VITE_API_BASE_URL || "").trim()) return;
    void refreshMembershipLifecycle();
  }, [authReady, user?.email, refreshMembershipLifecycle]);

  useEffect(() => {
    if (appState !== "member_portal") return;
    if (!(import.meta.env.VITE_API_BASE_URL || "").trim()) return;
    if (!membershipLifecycle || typeof membershipLifecycle.canAccessFullMemberPortal !== "boolean") return;
    if (!membershipLifecycle.canAccessFullMemberPortal) {
      setAppState("member_pending");
    }
  }, [appState, membershipLifecycle]);

  useEffect(() => {
    if (appState !== "admin_dashboard" || !staffAccessToken) return;
    let cancelled = false;
    void PmesService.fetchMembershipPipeline(staffAccessToken)
      .then((rows) => {
        if (!cancelled) setMembershipPipeline(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setMembershipPipeline([]);
      });
    return () => {
      cancelled = true;
    };
  }, [appState, staffAccessToken]);

  useEffect(() => {
    if (appState !== "admin_dashboard" || !staffAccessToken) return;
    let cancelled = false;
    setRegistryLoading(true);
    void PmesService.fetchMemberRegistry(staffAccessToken, {
      q: registryAppliedSearch,
      page: registryPage,
      pageSize: REGISTRY_PAGE_SIZE,
      includeAll: registryIncludeAll,
    })
      .then((data) => {
        if (cancelled) return;
        setRegistryRows(Array.isArray(data?.rows) ? data.rows : []);
        setRegistryTotal(typeof data?.total === "number" ? data.total : 0);
      })
      .catch(() => {
        if (!cancelled) {
          setRegistryRows([]);
          setRegistryTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setRegistryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appState, staffAccessToken, registryAppliedSearch, registryIncludeAll, registryPage]);

  const handleLoiSubmit = async () => {
    if (!loiData.address || !loiData.occupation || !loiData.initialCapital || !loiData.agreement) {
      setError("Please complete all fields.");
      return;
    }
    setLoading(true);
    try {
      await PmesService.saveLoi(db, appId, user, {
        ...formData,
        ...loiData,
        ...(activeRecord?.id != null ? { pmesRecordId: activeRecord.id } : {}),
      });
      void refreshMembershipLifecycle();
      setAppState("loi_success");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Submission failed.";
      console.error("[LOI submit]", e);
      setError(msg?.trim() || "Submission failed.");
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

  const handleDeleteMasterListRow = async (item) => {
    if (!staffAccessToken || staffRole !== "superuser" || !item?.id) return;
    const name = String(item.fullName ?? "this participant").trim() || "this participant";
    if (!window.confirm(`Remove the PMES master list row for ${name}? This cannot be undone.`)) return;
    setDeletingMasterListId(item.id);
    try {
      await PmesService.deletePmesRecord(staffAccessToken, item.id);
      setMasterList((list) => list.filter((r) => r.id !== item.id));
      if (activeRecord?.id === item.id) {
        setActiveRecord(null);
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingMasterListId(null);
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
    setMembershipLifecycle(null);
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
    const fn = signUp.firstName.trim();
    const ln = signUp.lastName.trim();
    const mn = signUp.middleName.trim();
    const phone = signUp.phone.trim();
    const addr = signUp.residenceAddress.trim();
    const email = signUp.email.trim();
    if (!fn || !ln) {
      setError("First name and last name are required.");
      return;
    }
    if (!signUp.dob) {
      setError("Date of birth is required.");
      return;
    }
    if (!phone) {
      setError("Mobile number is required.");
      return;
    }
    if (!addr) {
      setError("Residence address is required.");
      return;
    }
    if (!email || !signUp.password) {
      setError("Email and password are required.");
      return;
    }
    if (signUp.password !== signUp.confirm) {
      setError("Passwords do not match.");
      return;
    }
    const fullName = composeFullName(fn, mn, ln);
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, signUp.password);
      await updateProfile(cred.user, { displayName: fullName }).catch(() => null);
      if (import.meta.env.VITE_API_BASE_URL?.trim()) {
        void syncMemberToPostgres(cred.user, fullName);
      }
      setFormData((prev) => ({
        ...prev,
        email,
        firstName: fn,
        middleName: mn,
        lastName: ln,
        fullName,
        phone,
        dob: signUp.dob,
        residenceAddress: addr,
      }));
      setLogIn({ email, password: "" });
      setPmesPaused(false);
      queueSignupLiveActivityFromDevice();
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
    const sessionUser = user ?? (isFirebaseConfigured ? auth.currentUser : null);
    if (!sessionUser) return;

    hydratingRef.current = true;
    setPmesPaused(false);

    void loadPmesProgress(db, appId, sessionUser.uid)
      .then((prog) => {
        if (prog && typeof prog === "object") {
          applyLoadedProgress({ ...prog, pmesPaused: false });
        }

        const saved = typeof prog?.appState === "string" ? prog.appState : null;
        let next;

        if (saved && RESUMABLE_APP_STATES.has(saved)) {
          next = saved;
          if (next === "registration" && prog?.formData && isParticipantProfileComplete(prog.formData)) {
            next = "seminar";
          }
        } else {
          next = lastFlowAppStateRef.current || "seminar";
          if (next === "registration" && prog?.formData && isParticipantProfileComplete(prog.formData)) {
            next = "seminar";
          }
        }

        setAppState(next);
      })
      .catch(() => {
        setAppState(lastFlowAppStateRef.current || "seminar");
      })
      .finally(() => {
        hydratingRef.current = false;
      });
  };

  const beginJoinAsGuest = useCallback(
    (authMode) => {
      if (!isFirebaseConfigured) return;
      pendingPostAuthUnifiedJoinRef.current = true;
      setMemberAuthMode(authMode);
      setAppState("member_auth");
    },
    [isFirebaseConfigured],
  );

  const goJoinUnified = useCallback(async () => {
    if (!isFirebaseConfigured) return;
    const sessionUser = user ?? (isFirebaseConfigured ? auth.currentUser : null);
    if (!sessionUser) return;
    const api = Boolean((import.meta.env.VITE_API_BASE_URL || "").trim());
    let life = membershipLifecycle;
    if (api && sessionUser.email) {
      life = await refreshMembershipLifecycle();
    }
    const examPassed = Boolean((typeof score === "number" && score >= 7) || activeRecord?.passed === true);
    const intent = derivePmesIntent({
      pmesPaused,
      lastFlowAppState: lastFlowAppStateRef.current,
      pmesExamPassed: examPassed,
    });
    const resumeSuggested = Boolean(sessionUser) && !examPassed && intent.resumeRecommended;
    const plan = planJoinNavigation({
      useApi: api,
      lifecycle: life,
      pmesExamPassed: examPassed,
      resumePmesSuggested: resumeSuggested,
      isLoggedIn: true,
    });
    setPmesPaused(false);
    if (plan.type === "state") {
      setAppState(plan.value);
    } else if (plan.type === "continue_pmes") {
      continuePmesFromLanding();
    }
  }, [
    isFirebaseConfigured,
    user,
    membershipLifecycle,
    score,
    activeRecord,
    pmesPaused,
    refreshMembershipLifecycle,
    continuePmesFromLanding,
  ]);

  useEffect(() => {
    if (!authReady || !user || !pendingPostAuthUnifiedJoinRef.current) return;
    /** Brief delay so Firestore PMES progress can load before we branch the join path. */
    const t = window.setTimeout(() => {
      if (!pendingPostAuthUnifiedJoinRef.current) return;
      pendingPostAuthUnifiedJoinRef.current = false;
      void goJoinUnified();
    }, 450);
    return () => window.clearTimeout(t);
  }, [authReady, user?.uid, goJoinUnified]);

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
  /** Ribbon shows first + last only (middle omitted; legacy full names → first token + last token). */
  const memberDisplayNameForBanner =
    displayNameFirstLast(formData, activeRecord?.fullName, user?.displayName) || "Member";

  /** Fixed Home control on every flow screen except the marketing homepage. */
  const portalHomeBar =
    appState !== "landing" ? <PortalHomeBar onGoHome={() => setAppState("landing")} /> : null;

  /** Passed PMES: session score or saved API record — hides “Continue PMES” on the landing page when complete. */
  const pmesExamPassed = Boolean(
    user && ((typeof score === "number" && score >= 7) || activeRecord?.passed === true),
  );

  const pmesIntent = derivePmesIntent({
    pmesPaused,
    lastFlowAppState: lastFlowAppStateRef.current,
    pmesExamPassed,
  });

  const resumePmesSuggested = Boolean(user) && !pmesExamPassed && pmesIntent.resumeRecommended;

  const useApiMembership = Boolean((import.meta.env.VITE_API_BASE_URL || "").trim());
  const accessForRibbon = resolveMemberPortalAccess({
    useApi: useApiMembership,
    apiLifecycle: membershipLifecycle,
    pmesExamPassed,
  });

  const joinPipelineBanner =
    sessionUser && appState === "landing"
      ? getJoinPipelineBanner({
          useApi: useApiMembership,
          lifecycle: membershipLifecycle,
          pmesExamPassed,
        })
      : null;

  const hidePmesEntry = shouldHidePmesEntry({
    useApi: useApiMembership,
    lifecycle: membershipLifecycle,
    pmesExamPassed,
  });

  const memberIdentityForBanner =
    user && appState !== "member_auth" && !staffForBanner
      ? {
          fullName: memberDisplayNameForBanner,
          email: user.email || String(formData.email || "").trim() || "",
          ribbonStatus: accessForRibbon.ribbonStatus,
        }
      : null;
  const identityRibbon = <IdentityBanner member={memberIdentityForBanner} staff={staffForBanner} />;

  if (isFirebaseConfigured && !sessionUser && MEMBER_AUTH_REQUIRED_STATES.has(appState)) {
    return (
      <>
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen flex-col sm:flex-row">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <aside className="relative flex flex-col justify-start overflow-hidden bg-gradient-to-br from-[#004aad] via-[#003d8f] to-slate-900 px-8 py-12 text-white sm:w-[42%] sm:min-h-screen sm:shrink-0 sm:py-12 sm:pl-8 sm:pr-6 md:py-14 md:pl-10 md:pr-8 xl:py-16 xl:pl-14 xl:pr-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-16 left-10 h-48 w-48 rounded-full bg-blue-400/20 blur-2xl" aria-hidden />
            <div className="relative z-10 mb-8">
              <B2CLogo size="lg" className="max-w-[min(100%,15rem)] drop-shadow-md md:h-16" />
            </div>
            <p className="relative z-10 text-xs font-black uppercase tracking-[0.25em] text-white/70">B2C PMES</p>
            <h1 className="relative z-10 mt-4 max-w-md text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-[2.35rem] md:leading-[1.15]">
              Continue your membership journey
            </h1>
            <p className="relative z-10 mt-4 max-w-sm text-base font-medium leading-relaxed text-white/85">
              Sign in or create one account for the seminar, exam, and digital certificate.
            </p>
            <ul className="relative z-10 mt-8 max-w-sm space-y-3 text-sm font-semibold text-white/90">
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
          <div className="flex flex-1 items-center justify-center bg-slate-100/90 px-5 py-10 sm:px-10 sm:bg-[#f1f5f9] sm:py-12">
            <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-900/5 sm:p-10 sm:rounded-[2.25rem]">
              <div className="mb-6 flex justify-center sm:hidden">
                <B2CLogo size="md" align="center" className="max-w-[13rem]" />
              </div>
              <div className="text-center sm:text-left">
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
        {identityRibbon}{portalHomeBar}
        <div className="animate-in fade-in duration-500 flex min-h-screen flex-col sm:flex-row">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <aside className="relative flex flex-col justify-start overflow-hidden bg-gradient-to-br from-[#004aad] via-[#003d8f] to-slate-900 px-8 py-10 text-white sm:w-[42%] sm:min-h-screen sm:shrink-0 sm:py-14 sm:pl-8 sm:pr-6 md:pl-10 md:pr-8 xl:py-16 xl:pl-14 xl:pr-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-blue-400/15 blur-2xl" aria-hidden />
            <div className="relative z-10 mb-8">
              <B2CLogo size="lg" className="max-w-[min(100%,15rem)] drop-shadow-md md:h-16" />
            </div>
            <p className="relative z-10 text-xs font-black uppercase tracking-[0.25em] text-white/70">Member account</p>
            <h1 className="relative z-10 mt-4 max-w-lg text-3xl font-black leading-[1.12] tracking-tight sm:text-4xl md:text-[2.5rem] xl:text-[2.75rem]">
              {isSignup ? "Create your cooperative login" : "Welcome back, member"}
            </h1>
            <p className="relative z-10 mt-5 max-w-md text-base font-medium leading-relaxed text-white/88 sm:text-lg">
              {isSignup
                ? "One account for PMES modules, your exam, and your certificate. Next: privacy notice, then the seminar."
                : "Pick up where you left off — modules, exam, certificate, or Letter of Intent."}
            </p>
            <ul className="relative z-10 mt-8 hidden max-w-md space-y-3 text-sm font-semibold leading-snug text-white/90 sm:block">
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
          <div className="flex flex-1 items-center justify-center bg-slate-100/90 px-4 py-10 sm:px-8 sm:bg-[#f1f5f9] sm:py-12">
            <form
              onSubmit={isSignup ? handleSignUpSubmit : handleLoginSubmit}
              className="w-full max-w-xl rounded-[1.75rem] border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-900/[0.06] sm:max-w-2xl sm:rounded-[2rem] sm:p-10"
            >
              <div className="mb-5 flex justify-center sm:hidden">
                <B2CLogo size="md" align="center" className="max-w-[12rem]" />
              </div>
              <div className="text-center sm:text-left">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#004aad]/10 text-[#004aad] sm:mx-0 sm:mb-5 sm:h-14 sm:w-14">
                  {isSignup ? <UserPlus className="h-7 w-7" aria-hidden /> : <Lock className="h-7 w-7" aria-hidden />}
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-[#004aad]/80">
                  {isSignup ? "New registration" : "Member sign-in"}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  {isSignup ? "Create your login" : "Log in to continue"}
                </h2>
                {!isSignup ? (
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                    Resume your PMES, certificate, and member tools.
                  </p>
                ) : null}
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
                {isSignup ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                        <input
                          type="text"
                          name="given-name"
                          autoComplete="given-name"
                          className="input-field !py-[1.1rem] !pl-12 !text-base sm:!text-lg"
                          placeholder="First name"
                          value={signUp.firstName}
                          onChange={(e) => setSignUp((s) => ({ ...s, firstName: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                        <input
                          type="text"
                          name="additional-name"
                          autoComplete="additional-name"
                          className="input-field !py-[1.1rem] !pl-12 !text-base sm:!text-lg"
                          placeholder="Optional middle name"
                          value={signUp.middleName}
                          onChange={(e) => setSignUp((s) => ({ ...s, middleName: e.target.value }))}
                        />
                      </div>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                        <input
                          type="text"
                          name="family-name"
                          autoComplete="family-name"
                          className="input-field !py-[1.1rem] !pl-12 !text-base sm:!text-lg"
                          placeholder="Last name"
                          value={signUp.lastName}
                          onChange={(e) => setSignUp((s) => ({ ...s, lastName: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                      <input
                        type="tel"
                        autoComplete="tel-national"
                        inputMode="tel"
                        className="input-field !py-[1.1rem] !pl-12 !text-base sm:!text-lg"
                        placeholder="Mobile number"
                        value={signUp.phone}
                        onChange={(e) => setSignUp((s) => ({ ...s, phone: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                      <input
                        type="date"
                        className="input-field !py-[1.1rem] !pl-12 !text-base sm:!text-lg"
                        value={signUp.dob}
                        onChange={(e) => setSignUp((s) => ({ ...s, dob: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-slate-400" aria-hidden />
                      <textarea
                        autoComplete="street-address"
                        className="input-field min-h-[5.5rem] resize-y !py-[1rem] !pl-12 !text-base sm:!text-lg"
                        placeholder="Residence address"
                        rows={3}
                        value={signUp.residenceAddress}
                        onChange={(e) => setSignUp((s) => ({ ...s, residenceAddress: e.target.value }))}
                        required
                      />
                    </div>
                  </>
                ) : null}
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
                className={`w-full rounded-2xl py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#004aad] ${!isSignup ? "mt-4" : "mt-6"}`}
              >
                Back to home
              </button>
              {!isSignup ? (
                <button
                  type="button"
                  onClick={() => switchMemberAuthMode("signup")}
                  className="mt-3 w-full text-sm font-bold text-[#004aad] hover:underline"
                >
                  New member? Create an account
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMemberAuthMode("login")}
                  className="mt-3 w-full text-sm font-bold text-slate-500 hover:text-[#004aad]"
                >
                  Already have an account? Sign in
                </button>
              )}
            </form>
          </div>
        </div>
      </>
    );
  }

  if (appState === "pioneer_reclaim")
    return (
      <>
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 sm:p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <div className="card-senior w-full max-w-lg space-y-6">
            <B2CLogo size="md" align="center" />
            <div className="flex items-start gap-3">
              <HeartHandshake className="mt-1 h-10 w-10 shrink-0 text-[#004aad]" aria-hidden />
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-[#004aad]">Founding pioneer</h1>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                  If you were on the roster before this app, confirm the email and birth date we have on file. Then use{" "}
                  <strong>that same email</strong> to sign in or create your account so your digital membership form opens.
                </p>
              </div>
            </div>
            {!Boolean((import.meta.env.VITE_API_BASE_URL || "").trim()) ? (
              <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-950">
                Set <code className="rounded bg-white px-1">VITE_API_BASE_URL</code> in <code className="rounded bg-white px-1">frontend/.env</code>{" "}
                so we can verify your roster row.
              </div>
            ) : (
              <>
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPioneerReclaimError(null);
                    setPioneerReclaimEligible(null);
                    setPioneerReclaimLoading(true);
                    try {
                      const res = await PmesService.checkPioneerEligibility(pioneerReclaimEmail, pioneerReclaimDob);
                      setPioneerReclaimEligible(Boolean(res?.eligible));
                    } catch (err) {
                      setPioneerReclaimError(err instanceof Error ? err.message : "Verification failed.");
                    } finally {
                      setPioneerReclaimLoading(false);
                    }
                  }}
                >
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500" htmlFor="pioneer-email">
                      Email on file
                    </label>
                    <input
                      id="pioneer-email"
                      type="email"
                      autoComplete="email"
                      className="input-field w-full"
                      value={pioneerReclaimEmail}
                      onChange={(ev) => setPioneerReclaimEmail(ev.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500" htmlFor="pioneer-dob">
                      Date of birth (same format as records, e.g. YYYY-MM-DD)
                    </label>
                    <input
                      id="pioneer-dob"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday"
                      placeholder="YYYY-MM-DD"
                      className="input-field w-full"
                      value={pioneerReclaimDob}
                      onChange={(ev) => setPioneerReclaimDob(ev.target.value)}
                      required
                    />
                  </div>
                  {pioneerReclaimError ? (
                    <div className="rounded-2xl bg-red-50 p-3 text-center text-sm font-bold text-red-800">{pioneerReclaimError}</div>
                  ) : null}
                  <button type="submit" disabled={pioneerReclaimLoading} className="btn-primary flex w-full items-center justify-center gap-2 py-4">
                    {pioneerReclaimLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
                    Check eligibility
                  </button>
                </form>
                {pioneerReclaimEligible === true ? (
                  <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4">
                    <p className="text-sm font-bold text-emerald-950">
                      You&apos;re on the pioneer import list and still need the digital profile. Sign in or register with{" "}
                      <strong>this exact email</strong>.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        className="btn-primary flex-1 py-3 text-sm font-black uppercase"
                        onClick={() => {
                          try {
                            sessionStorage.setItem(
                              "b2c_pioneer_prefill",
                              JSON.stringify({
                                email: pioneerReclaimEmail.trim(),
                                dob: pioneerReclaimDob.trim(),
                              }),
                            );
                          } catch {
                            /* ignore */
                          }
                          pendingAfterAuthRef.current = "pioneer_portal";
                          setMemberAuthMode("login");
                          setAppState("member_auth");
                        }}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        className="btn-secondary flex-1 py-3 text-sm font-black uppercase"
                        onClick={() => {
                          try {
                            sessionStorage.setItem(
                              "b2c_pioneer_prefill",
                              JSON.stringify({
                                email: pioneerReclaimEmail.trim(),
                                dob: pioneerReclaimDob.trim(),
                              }),
                            );
                          } catch {
                            /* ignore */
                          }
                          pendingAfterAuthRef.current = "pioneer_portal";
                          setMemberAuthMode("signup");
                          setAppState("member_auth");
                        }}
                      >
                        Create account
                      </button>
                    </div>
                  </div>
                ) : null}
                {pioneerReclaimEligible === false ? (
                  <p className="text-sm font-medium leading-relaxed text-slate-600">
                    We couldn&apos;t match a pioneer row that still needs a profile. Check the email and DOB (including format),
                    or contact the cooperative office. If you already finished the digital form, you won&apos;t see a match
                    here.
                  </p>
                ) : null}
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setPioneerReclaimError(null);
                setPioneerReclaimEligible(null);
                setAppState("landing");
              }}
              className="w-full text-center text-sm font-bold text-slate-500 hover:text-[#004aad]"
            >
              Back to home
            </button>
          </div>
        </div>
      </>
    );

  if (appState === "landing")
    return (
      <>
        {identityRibbon}{portalHomeBar}
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <LandingPage
          isFirebaseConfigured={isFirebaseConfigured}
          authUser={user}
          resumePmesSuggested={resumePmesSuggested}
          pmesExamPassed={pmesExamPassed}
          joinPipelineBanner={joinPipelineBanner}
          hidePmesEntry={hidePmesEntry}
          onJoinUs={() => {
            if (!isFirebaseConfigured) return;
            if (!user) {
              beginJoinAsGuest("signup");
              return;
            }
            void goJoinUnified();
          }}
          onLogin={() => {
            pendingPostAuthUnifiedJoinRef.current = false;
            setMemberAuthMode("login");
            setAppState("member_auth");
          }}
          onLogout={handleLogout}
          onContinuePmes={user && resumePmesSuggested ? continuePmesFromLanding : undefined}
          onStartPmes={() => {
            if (!isFirebaseConfigured) return;
            if (!user) {
              beginJoinAsGuest("login");
              return;
            }
            void goJoinUnified();
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
          onPioneerReclaim={() => {
            if (!isFirebaseConfigured) return;
            setPioneerReclaimError(null);
            setPioneerReclaimEligible(null);
            setAppState("pioneer_reclaim");
          }}
          onMemberPortal={async () => {
            if (!user) return;
            const api = Boolean((import.meta.env.VITE_API_BASE_URL || "").trim());
            if (!api) {
              setAppState("member_portal");
              return;
            }
            const row = await refreshMembershipLifecycle();
            const access = resolveMemberPortalAccess({
              useApi: true,
              apiLifecycle: row,
              pmesExamPassed,
            });
            if (access.canAccessFullMemberPortal) setAppState("member_portal");
            else setAppState("member_pending");
          }}
          onMemberProfile={() => {
            if (!user) return;
            registrationNavRef.current = "portal";
            setAppState("registration");
          }}
        />
      </>
    );

  if (appState === "seminar")
    return (
      <>
        {identityRibbon}{portalHomeBar}
        <div className="min-h-screen px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl md:rounded-[2.5rem] lg:rounded-[3rem]">
          <div className="flex flex-col gap-4 bg-[#004aad] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:p-10">
            <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-6">
              <B2CLogo size="xs" className="shrink-0 drop-shadow-sm sm:h-10 sm:max-w-[170px]" />
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
        {identityRibbon}{portalHomeBar}
        <div className="min-h-screen px-8 py-16">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto mb-10 flex max-w-5xl items-center justify-between gap-4">
          <B2CLogo size="sm" className="shrink-0" />
          <button
            type="button"
            onClick={goHomeFromPmes}
            className="btn-secondary inline-flex shrink-0 items-center gap-2 py-3 text-lg font-bold"
          >
            <House className="h-5 w-5" aria-hidden />
            Save &amp; home
          </button>
        </div>
        <div className="mx-auto w-full max-w-5xl space-y-16 rounded-[4rem] bg-white p-16 shadow-2xl">
          <B2CLogo size="md" align="center" className="mb-2" />
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
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-10 text-center">
          <B2CLogo size="md" align="center" className="mb-2" />
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
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen flex-col items-center bg-slate-100 p-8 sm:p-20">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        {!activeRecord?.fullName ? (
          <div className="card-senior w-full max-w-lg space-y-8 text-center">
            <B2CLogo size="md" align="center" />
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
              <button
                type="button"
                onClick={() => {
                  setLoiData((prev) => ({
                    ...prev,
                    address: String(prev.address || "").trim() || String(formData.residenceAddress || "").trim() || "",
                  }));
                  setAppState("loi_form");
                }}
                className="btn-primary flex-1 py-8 text-2xl uppercase tracking-tighter"
              >
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
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-12">
          <B2CLogo size="lg" align="center" />
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
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-10 border-emerald-100 text-center">
          <B2CLogo size="md" align="center" />
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
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-2xl space-y-8 text-center">
          <B2CLogo size="lg" align="center" />
          <Coins className="mx-auto h-16 w-16 text-[#004aad]" aria-hidden />
          <h1 className="text-3xl font-black uppercase tracking-tighter text-[#004aad] md:text-4xl">Share capital &amp; membership</h1>
          <p className="text-lg font-medium leading-relaxed text-slate-600">
            <strong>Scan the code below</strong> with your phone camera. It will open{" "}
            <strong>Facebook Messenger</strong> so you can chat with us about share capital and membership fee payments.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-6">
            <MessengerPaymentQr />
            <p className="mt-4 text-sm font-medium text-slate-500">
              Tip: use your camera app or Messenger — scan, then tap the banner to open the chat.
            </p>
          </div>
          <p className="text-lg font-medium leading-relaxed text-slate-600">
            On a computer or if you prefer a link: contact <strong>B2CCoop</strong> via Facebook Messenger at{" "}
            <a
              href={MESSENGER_PAYMENT_CHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#004aad] underline decoration-2 underline-offset-2 hover:text-[#004aad]/90"
            >
              m.me/278382175357935
            </a>
            .
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
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <div className="card-senior w-full max-w-2xl space-y-10">
            <B2CLogo size="lg" align="center" />
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
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen items-center justify-center p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-8">
          <div className="text-center">
            <B2CLogo size="lg" align="center" className="mb-6" />
            <ShieldAlert className="mx-auto h-20 w-20 animate-bounce text-[#004aad]" />
            <h1 className="mt-4 text-4xl font-black uppercase tracking-tighter text-[#004aad] sm:text-5xl">{PRIVACY_NOTICE_HEADING}</h1>
            <p className="mt-3 text-lg font-semibold text-slate-600">Please read the following before continuing.</p>
          </div>
          <div
            className="max-h-[min(28rem,55vh)] space-y-4 overflow-y-auto rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-left text-lg leading-relaxed text-slate-700 shadow-inner"
            role="region"
            aria-label="Privacy agreement text"
          >
            {PRIVACY_NOTICE_PARAGRAPHS.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p>{PRIVACY_PMES_CONSENT_CLOSING}</p>
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
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-4 pb-16 pt-8 sm:p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-3xl space-y-8">
          <div className="text-center">
            <B2CLogo size="lg" align="center" className="mb-6" />
            <h1 className="text-4xl font-black uppercase tracking-tighter text-[#004aad] sm:text-5xl">Member profile</h1>
            <p className="mt-3 text-lg font-semibold text-slate-600">
              Confirm or edit your details for your PMES record, certificate, LOI, and retrieval. Sign-up already captured your
              login email and basic profile.
            </p>
            {regNav === "exam" ? (
              <p className="mt-2 text-sm font-bold text-amber-800">Complete these details to continue to the exam.</p>
            ) : null}
          </div>
          <div className="space-y-8">
            {error && <div className="rounded-2xl bg-red-50 p-4 text-center font-bold text-red-600">{error}</div>}
            <div className="grid gap-6 sm:grid-cols-3">
              <input
                type="text"
                className="input-field"
                placeholder="First name"
                value={formData.firstName}
                onChange={(event) =>
                  setFormData((prev) => {
                    const next = { ...prev, firstName: event.target.value };
                    next.fullName = composeFullName(next.firstName, next.middleName, next.lastName);
                    return next;
                  })
                }
              />
              <input
                type="text"
                className="input-field"
                placeholder="Optional middle name"
                value={formData.middleName}
                onChange={(event) =>
                  setFormData((prev) => {
                    const next = { ...prev, middleName: event.target.value };
                    next.fullName = composeFullName(next.firstName, next.middleName, next.lastName);
                    return next;
                  })
                }
              />
              <input
                type="text"
                className="input-field"
                placeholder="Last name"
                value={formData.lastName}
                onChange={(event) =>
                  setFormData((prev) => {
                    const next = { ...prev, lastName: event.target.value };
                    next.fullName = composeFullName(next.firstName, next.middleName, next.lastName);
                    return next;
                  })
                }
              />
            </div>
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
            <input type="tel" className="input-field" placeholder="Mobile number" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
            <textarea
              className="input-field min-h-[6rem] resize-y"
              placeholder="Residence address"
              rows={3}
              value={formData.residenceAddress}
              onChange={(event) => setFormData({ ...formData, residenceAddress: event.target.value })}
            />
            <button
              type="button"
              onClick={() => {
                const composed =
                  composeFullName(formData.firstName, formData.middleName, formData.lastName).trim() ||
                  String(formData.fullName || "").trim();
                if (!composed || !formData.dob || !formData.email || !formData.gender) {
                  setError("Fill all required fields including name, gender, and date of birth.");
                  return;
                }
                if (!String(formData.phone || "").trim()) {
                  setError("Mobile number is required.");
                  return;
                }
                if (!String(formData.residenceAddress || "").trim()) {
                  setError("Residence address is required.");
                  return;
                }
                setError(null);
                setFormData((prev) => ({ ...prev, fullName: composed }));
                if (user) {
                  void updateProfile(user, { displayName: composed.trim() }).catch(() => null);
                }
                const from = registrationNavRef.current;
                registrationNavRef.current = "menu";
                if (from === "exam") {
                  setAppState("exam");
                } else if (from === "portal") {
                  const full = Boolean(membershipLifecycle?.canAccessFullMemberPortal);
                  setAppState(useApiMembership && !full ? "member_pending" : "member_portal");
                } else {
                  setAppState("seminar");
                }
              }}
              className="btn-primary w-full py-6 text-2xl font-black uppercase tracking-tighter sm:py-8 sm:text-3xl"
            >
              {regNav === "exam"
                ? "Continue to exam"
                : regNav === "portal"
                  ? "Save & return to portal"
                  : "Save & continue"}
            </button>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  const from = registrationNavRef.current;
                  registrationNavRef.current = "menu";
                  if (from === "exam") setAppState("seminar");
                  else if (from === "portal") {
                    const full = Boolean(membershipLifecycle?.canAccessFullMemberPortal);
                    setAppState(useApiMembership && !full ? "member_pending" : "member_portal");
                  } else setAppState("landing");
                }}
                className="text-sm font-bold text-slate-500 hover:text-[#004aad]"
              >
                {regNav === "exam" ? "Back to modules" : regNav === "portal" ? "Back to member portal" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (appState === "member_pending") {
    const memberDisplayName = displayNameFirstLast(formData, activeRecord?.fullName, user?.displayName);
    return (
      <>
        {identityRibbon}
        {portalHomeBar}
        <div className="flex min-h-screen flex-col items-center bg-slate-100/80 p-4 pb-24 pt-8 sm:p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <MemberLifecyclePortal
            lifecycle={membershipLifecycle}
            displayName={memberDisplayName}
            email={user?.email || ""}
            loading={membershipLoading}
            apiConfigured={useApiMembership}
            clientPmesPassed={pmesExamPassed}
            onViewCertificate={() => setAppState("certificate")}
            onContinuePmes={() => {
              void continuePmesFromLanding();
            }}
            onOpenLoi={() => {
              setLoiData((prev) => ({
                ...prev,
                address: String(prev.address || "").trim() || String(formData.residenceAddress || "").trim() || "",
              }));
              setAppState("loi_form");
            }}
            onOpenPayment={() => setAppState("payment_portal")}
            onSubmitFullProfile={async ({ profileJson, sheetFileName, notes }) => {
              if (!user?.email) return;
              await PmesService.submitFullProfile({
                email: user.email,
                profileJson,
                sheetFileName,
                notes: notes ?? "",
              });
              await refreshMembershipLifecycle();
              setAppState("member_portal");
            }}
          />
        </div>
      </>
    );
  }

  if (appState === "member_portal") {
    const memberDisplayName = displayNameFirstLast(formData, activeRecord?.fullName, user?.displayName);
    const referralCode = user?.uid
      ? `PIONEER-${String(user.uid).replace(/-/g, "").slice(-8).toUpperCase()}`
      : "PIONEER-PENDING";
    const pioneerPoints = pioneerReferral.successfulJoinCount * PIONEER_POINTS_PER_JOIN;
    return (
      <>
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen flex-col items-center gap-10 p-4 pb-20 pt-8 sm:p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
          <div className="w-full max-w-5xl space-y-8">
            <div className="text-center">
              <B2CLogo size="lg" align="center" className="mb-4" />
              <h1 className="text-4xl font-black uppercase tracking-tighter text-[#004aad] sm:text-5xl">Member portal</h1>
              <p className="mt-3 text-lg font-semibold text-slate-600">
                Pioneer growth, your profile, and cooperative tools — without the PMES intake form unless you choose to edit.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  registrationNavRef.current = "portal";
                  setAppState("registration");
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-[#004aad]/25 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-[#004aad] shadow-sm transition hover:border-[#004aad]/50 hover:bg-[#004aad]/5"
              >
                <IdCard className="h-5 w-5 shrink-0" aria-hidden />
                Edit profile
              </button>
              {pmesExamPassed ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAppState("certificate")}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/80"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                    My certificate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoiData((prev) => ({
                        ...prev,
                        address: String(prev.address || "").trim() || String(formData.residenceAddress || "").trim() || "",
                      }));
                      setAppState("loi_form");
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-800 shadow-sm transition hover:border-[#004aad]/40"
                  >
                    <Briefcase className="h-5 w-5 shrink-0 text-[#004aad]" aria-hidden />
                    Letter of Intent
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppState("payment_portal")}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/80"
                  >
                    <Coins className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                    Payments
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setRetrievalData((d) => ({ ...d, email: user?.email || d.email }));
                  setAppState("login_retrieval");
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300"
              >
                Retrieve certificate
              </button>
            </div>

            {user ? (
              <ReferralEngine
                memberName={memberDisplayName || "Member"}
                referralCode={referralCode}
                successfulJoinCount={pioneerReferral.successfulJoinCount}
                pioneerPoints={pioneerPoints}
                invitesThisMonth={pioneerReferral.invitesThisMonth}
              />
            ) : null}
          </div>
        </div>
      </>
    );
  }

  if (appState === "admin_login")
    return (
      <>
        {identityRibbon}{portalHomeBar}
        <div className="flex min-h-screen items-center justify-center bg-[#004aad]/5 p-8">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <form onSubmit={handleAdminLoginSubmit} className="card-senior w-full max-w-md space-y-8">
          <div className="text-center">
            <B2CLogo size="lg" align="center" className="mb-4" />
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
        {identityRibbon}{portalHomeBar}
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8 lg:p-12">
          <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-white shadow-xl lg:rounded-[2.5rem]">
          <div className="flex flex-col gap-6 bg-[#004aad] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="flex items-center gap-4">
              <B2CLogo size="lg" className="shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Admin</p>
                <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">PMES master list</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMasterList([]);
                setRegistryRows([]);
                setRegistryTotal(0);
                setRegistryPage(1);
                setRegistrySearchInput("");
                setRegistryAppliedSearch("");
                setRegistryIncludeAll(false);
                setRegistryDetail(null);
                setAdminCreds({ email: "", password: "" });
                setStaffRole(null);
                setStaffAccessToken(null);
                setStaffSessionEmail(null);
                setManagedStaffAdmins([]);
                setNewStaffAdmin({ email: "", password: "" });
                setStaffAdminError(null);
                setDeletingMasterListId(null);
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
                  {staffRole === "superuser" ? (
                    <th className="p-4 lg:p-5 text-center">Delete</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {masterList.length === 0 ? (
                  <tr>
                    <td colSpan={staffRole === "superuser" ? 7 : 6} className="p-12 text-center text-lg font-semibold text-slate-500">
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
                        {staffRole === "superuser" ? (
                          <td className="p-4 align-top text-center lg:p-5">
                            <button
                              type="button"
                              disabled={deletingMasterListId === item.id}
                              onClick={() => handleDeleteMasterListRow(item)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase text-red-800 hover:bg-red-100 disabled:opacity-50"
                              title="Remove this PMES row (superuser only)"
                            >
                              {deletingMasterListId === item.id ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                              ) : (
                                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                              )}
                              Remove
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-10 lg:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Member registry</h2>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  Full membership profiles stored in the database (searchable mailing address, civil status, member ID). Use
                  Print / Save as PDF from the print dialog.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => printMemberRegistryTable(registryRows, "B2C member registry")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4 shrink-0" aria-hidden />
                  Print / PDF
                </button>
              </div>
            </div>
            <form
              className="mt-6 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                setRegistryPage(1);
                setRegistryAppliedSearch(registrySearchInput.trim());
              }}
            >
              <div className="min-w-0 flex-1 lg:max-w-md">
                <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500" htmlFor="registry-search">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden />
                  <input
                    id="registry-search"
                    className="input-field w-full pl-11"
                    placeholder="Name, email, phone, address, member ID…"
                    value={registrySearchInput}
                    onChange={(e) => setRegistrySearchInput(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 font-black">
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                Search
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={registryIncludeAll}
                  onChange={(e) => {
                    setRegistryIncludeAll(e.target.checked);
                    setRegistryPage(1);
                  }}
                />
                Include participants without a full profile
              </label>
            </form>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="p-4">Member</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Mailing address</th>
                    <th className="p-4">Civil status</th>
                    <th className="p-4">Member ID</th>
                    <th className="p-4 text-center">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {registryLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center font-medium text-slate-500">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#004aad]" aria-hidden />
                      </td>
                    </tr>
                  ) : registryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center font-medium text-slate-500">
                        No registry rows yet. Completed full profiles appear here (or enable “include all” to browse
                        participants).
                      </td>
                    </tr>
                  ) : (
                    registryRows.map((row) => {
                      const r = /** @type {Record<string, unknown>} */ (row);
                      return (
                        <tr key={String(r.participantId)} className="border-t border-slate-100">
                          <td className="p-4 align-top">
                            <p className="font-bold text-slate-900">{String(r.fullName ?? "—")}</p>
                            <p className="text-xs text-slate-500">DOB: {String(r.dob ?? "—")}</p>
                          </td>
                          <td className="p-4 align-top">
                            <p className="break-all text-slate-800">{String(r.email ?? "")}</p>
                            <p className="text-slate-600">{String(r.phone ?? "—")}</p>
                          </td>
                          <td className="p-4 align-top text-slate-700">{String(r.mailingAddress ?? "—")}</td>
                          <td className="p-4 align-top">{String(r.civilStatus ?? "—")}</td>
                          <td className="p-4 align-top font-mono text-xs">{String(r.memberIdNo ?? "—")}</td>
                          <td className="p-4 align-top text-center">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#004aad]/10 px-3 py-1.5 text-xs font-bold uppercase text-[#004aad] hover:bg-[#004aad]/20"
                              onClick={async () => {
                                if (!staffAccessToken) return;
                                try {
                                  const detail = await PmesService.fetchParticipantAdminDetail(
                                    staffAccessToken,
                                    String(r.participantId),
                                  );
                                  setRegistryDetail(detail);
                                } catch {
                                  setRegistryDetail(null);
                                }
                              }}
                            >
                              <Eye className="h-4 w-4 shrink-0" aria-hidden />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {registryTotal > REGISTRY_PAGE_SIZE ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-600">
                <span>
                  Page {registryPage} — {registryTotal} total
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={registryPage <= 1}
                    onClick={() => setRegistryPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs uppercase disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={registryPage * REGISTRY_PAGE_SIZE >= registryTotal}
                    onClick={() => setRegistryPage((p) => p + 1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs uppercase disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : registryTotal > 0 ? (
              <p className="mt-3 text-sm font-medium text-slate-500">{registryTotal} member(s) in this view.</p>
            ) : null}
          </div>
          {registryDetail ? (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="registry-detail-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setRegistryDetail(null);
              }}
            >
              <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-[#004aad] px-5 py-4 text-white">
                  <h2 id="registry-detail-title" className="text-lg font-black uppercase tracking-tight">
                    Member profile
                  </h2>
                  <button
                    type="button"
                    onClick={() => setRegistryDetail(null)}
                    className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/30"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-[calc(90vh-5rem)] overflow-y-auto p-5 text-sm text-slate-800">
                  {/** @type {Record<string, unknown>} */ (registryDetail).registry ? (
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {Object.entries(/** @type {Record<string, unknown>} */ (registryDetail).registry).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs font-black uppercase text-slate-500">{k}</dt>
                          <dd className="font-medium break-words">{v === null || v === undefined ? "—" : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <h3 className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Full membership JSON</h3>
                  <pre className="mt-2 max-h-[min(50vh,28rem)] overflow-auto rounded-xl bg-slate-50 p-3 text-xs leading-relaxed">
                    {JSON.stringify(/** @type {Record<string, unknown>} */ (registryDetail).memberProfileSnapshot ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-10 lg:px-10">
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Legacy pioneer import</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Preload roster members so they can use <strong>Pioneer roster — link your account</strong> on the home menu. Paste a
              JSON array of objects with <code className="rounded bg-slate-200 px-1">email</code>,{" "}
              <code className="rounded bg-slate-200 px-1">fullName</code>, <code className="rounded bg-slate-200 px-1">phone</code>,{" "}
              <code className="rounded bg-slate-200 px-1">dob</code> (match reclaim form, e.g. YYYY-MM-DD),{" "}
              <code className="rounded bg-slate-200 px-1">gender</code>. Rows are created at{" "}
              <strong>AWAITING_FULL_PROFILE</strong> (PMES passed, fees &amp; board marked for digital onboarding).
            </p>
            <textarea
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 shadow-inner"
              rows={10}
              value={legacyImportJson}
              onChange={(e) => setLegacyImportJson(e.target.value)}
              spellCheck={false}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={legacyImportLoading || !staffAccessToken}
                onClick={async () => {
                  setLegacyImportMsg(null);
                  setLegacyImportLoading(true);
                  try {
                    const rows = JSON.parse(legacyImportJson);
                    if (!Array.isArray(rows)) throw new Error("JSON must be an array.");
                    const result = await PmesService.importLegacyPioneers(staffAccessToken, rows);
                    setLegacyImportMsg(JSON.stringify(result, null, 2));
                    const next = await PmesService.fetchMembershipPipeline(staffAccessToken);
                    setMembershipPipeline(Array.isArray(next) ? next : []);
                  } catch (e) {
                    setLegacyImportMsg(e instanceof Error ? e.message : String(e));
                  } finally {
                    setLegacyImportLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#004aad] px-5 py-2.5 text-sm font-black uppercase text-white hover:bg-[#003d99] disabled:opacity-50"
              >
                {legacyImportLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Run import
              </button>
            </div>
            {legacyImportMsg ? (
              <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-slate-900/90 p-4 text-xs text-emerald-100">{legacyImportMsg}</pre>
            ) : null}
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-10 lg:px-10">
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Membership pipeline</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Record treasury receipt of share capital and membership fees, then Board approval. Members see the next step in
              their portal automatically.
            </p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="p-4">Participant</th>
                    <th className="p-4">Stage</th>
                    <th className="p-4">LOI</th>
                    <th className="p-4">Fees paid</th>
                    <th className="p-4">Board OK</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {membershipPipeline.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center font-medium text-slate-500">
                        No participants yet, or pipeline failed to load.
                      </td>
                    </tr>
                  ) : (
                    membershipPipeline.map((row) => (
                      <tr key={String(row.participantId)} className="border-t border-slate-100">
                        <td className="p-4 align-top">
                          <p className="font-bold text-slate-900">{String(row.fullName ?? "—")}</p>
                          <p className="break-all text-xs text-slate-500">{String(row.email ?? "")}</p>
                        </td>
                        <td className="p-4 align-top text-xs font-bold uppercase text-[#004aad]">{String(row.stage ?? "—")}</td>
                        <td className="p-4 align-top">{row.loiSubmitted ? "Yes" : "—"}</td>
                        <td className="p-4 align-top">{row.initialFeesPaid ? "Yes" : "—"}</td>
                        <td className="p-4 align-top">{row.boardApproved ? "Yes" : "—"}</td>
                        <td className="p-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            {row.loiSubmitted && !row.initialFeesPaid ? (
                              <button
                                type="button"
                                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-amber-700"
                                onClick={async () => {
                                  if (!staffAccessToken) return;
                                  await PmesService.updateParticipantMembership(staffAccessToken, String(row.participantId), {
                                    initialFeesPaid: true,
                                  });
                                  const next = await PmesService.fetchMembershipPipeline(staffAccessToken);
                                  setMembershipPipeline(Array.isArray(next) ? next : []);
                                }}
                              >
                                Mark fees received
                              </button>
                            ) : null}
                            {row.initialFeesPaid && !row.boardApproved ? (
                              <button
                                type="button"
                                className="rounded-lg bg-[#004aad] px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-[#003d99]"
                                onClick={async () => {
                                  if (!staffAccessToken) return;
                                  await PmesService.updateParticipantMembership(staffAccessToken, String(row.participantId), {
                                    boardApproved: true,
                                  });
                                  const next = await PmesService.fetchMembershipPipeline(staffAccessToken);
                                  setMembershipPipeline(Array.isArray(next) ? next : []);
                                }}
                              >
                                Board approved
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </>
    );

  return null;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Lock,
  Printer,
  ShieldCheck as AdminIcon,
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
import { requestTts } from "./services/ttsApi";
import { globalStyles } from "./styles/globalStyles";
import { PRIVACY_AGREEMENT_PARAGRAPHS } from "./constants/privacyAgreement";

/**
 * Gemini prebuilt voices (lively / energetic family): Sadachbia = lively, Zephyr = bright,
 * Puck = upbeat, Fenrir = excitable, Laomedeia = upbeat. OpenAI/Grok map unknown names server-side.
 */
const VOICE = "Sadachbia";
/** Bump when backend TTS output meaningfully changes — avoids replaying stale blob URLs from an old build. */
const TTS_CLIENT_CACHE_BUST = "2";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ fullName: "", gender: "", email: "", phone: "", dob: "" });
  const [loiData, setLoiData] = useState({ address: "", occupation: "", employer: "", initialCapital: "", agreement: false });
  const [retrievalData, setRetrievalData] = useState({ email: "", dob: "" });
  const [currentStep, setCurrentStep] = useState(0);
  const [openCardIndex, setOpenCardIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  /** Which narrative card key (`index-title`) is fetching/buffering audio — avoids disabling every card. */
  const [loadingTtsKey, setLoadingTtsKey] = useState(null);
  const [ttsError, setTtsError] = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);
  const [masterList, setMasterList] = useState([]);
  const [examQuestions, setExamQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [courseAudioEnabled, setCourseAudioEnabledState] = useState(readCourseAudioPreference);
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

  useEffect(() => {
    if (!isFirebaseConfigured) {
      if (import.meta.env.DEV) {
        console.info(
          "[PMES] Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in frontend/.env for Firestore and anonymous auth.",
        );
      }
    } else {
      signInAnonymously(auth).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn(
            "[PMES] Anonymous sign-in failed (Identity Toolkit 400 often means: enable Anonymous in Firebase Auth → Sign-in method, and add localhost to Authentication → Settings → Authorized domains).",
            err?.code ?? err,
          );
        }
      });
    }
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!ttsError) return undefined;
    const id = setTimeout(() => setTtsError(null), 12000);
    return () => clearTimeout(id);
  }, [ttsError]);

  const setCourseAudioEnabled = (enabled) => {
    if (!enabled) {
      currentAudio.current?.pause();
      setIsSpeaking(false);
    }
    setCourseAudioEnabledState(enabled);
    writeCourseAudioPreference(enabled);
  };

  const playTts = async (text, cacheKey) => {
    if (isSpeaking) {
      currentAudio.current?.pause();
      setIsSpeaking(false);
      return;
    }
    setTtsError(null);
    setLoadingTtsKey(cacheKey);
    try {
      const wavUrl = await ensureTtsUrl(text, cacheKey);
      const audio = await preloadAudioUrl(wavUrl);
      currentAudio.current = audio;
      audio.onended = () => setIsSpeaking(false);
      setIsSpeaking(true);
      await audio.play();
    } catch (err) {
      setTtsError(formatTtsError(err));
      setIsSpeaking(false);
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

  const handleRetrieval = async () => {
    setLoading(true);
    setError(null);
    const useApi = Boolean((import.meta.env.VITE_API_BASE_URL || "").trim());
    if (!useApi && !user) {
      setError("Please wait for sign-in, then try again.");
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

  if (appState === "landing")
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#004aad]/5 p-8">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-12 text-center">
          <img
            src="/b2c-logo.png"
            alt="B2C Coop Philippines"
            className="mx-auto h-36 w-auto object-contain drop-shadow-sm sm:h-44"
            width={220}
            height={176}
          />
          <h1 className="text-5xl font-black uppercase tracking-tighter text-[#004aad] sm:text-6xl">B2C Consumers Cooperative</h1>
          <p className="px-10 text-3xl font-bold text-slate-600">Official Member Education Portal</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <button onClick={() => setAppState("consent")} className="btn-primary py-10 text-2xl"><UserPlus className="h-10 w-10" />START PMES</button>
            <button onClick={() => setAppState("login_retrieval")} className="btn-secondary py-10 text-2xl"><Download className="h-10 w-10" />MY CERTIFICATE</button>
          </div>
          <button
            onClick={() => {
              const mm = String(new Date().getMonth() + 1).padStart(2, "0");
              const dd = String(new Date().getDate()).padStart(2, "0");
              const pass = prompt("Enter Admin Code:");
              if (pass === `B2C${mm}${dd}${new Date().getFullYear()}`) {
                PmesService.getAllRecords(db, appId, pass).then(setMasterList).catch(() => null);
                setAppState("admin_dashboard");
              }
            }}
            className="mx-auto flex items-center gap-2 font-bold text-slate-400 hover:text-[#004aad]"
          >
            <AdminIcon className="h-5 w-5" /> Admin Portal
          </button>
        </div>
      </div>
    );

  if (appState === "seminar")
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl md:rounded-[2.5rem] lg:rounded-[3rem]">
          <div className="flex flex-col gap-4 bg-[#004aad] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:p-10">
            <div className="flex min-w-0 items-center gap-4 md:gap-6">
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
            <div className="shrink-0 self-start rounded-full bg-black/20 px-4 py-2 text-lg font-bold tabular-nums sm:self-auto md:px-6 md:text-xl">
              {currentStep + 1} / {modules.length}
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
                prefetchTts={prefetchTts}
                playTts={playTts}
                isSpeaking={isSpeaking}
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
                  setExamQuestions([...questionPool].sort(() => 0.5 - Math.random()).slice(0, 10));
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
    );

  if (appState === "exam")
    return (
      <div className="min-h-screen px-8 py-16">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
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
    );

  if (appState === "result")
    return (
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
    );

  if (appState === "certificate")
    return (
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
              <button type="button" onClick={() => setAppState("landing")} className="btn-secondary flex-1 py-8 text-lg font-bold">
                Home
              </button>
            </div>
          </>
        )}
      </div>
    );

  if (appState === "loi_form")
    return (
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
    );

  if (appState === "loi_success")
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-4xl space-y-10 border-emerald-100 text-center">
          <Sparkles className="mx-auto h-32 w-32 animate-pulse text-emerald-500" />
          <h1 className="text-6xl font-black uppercase tracking-tighter text-[#004aad]">THANK YOU!</h1>
          <button onClick={() => setAppState("landing")} className="btn-primary w-full py-10 text-3xl">FINISH</button>
        </div>
      </div>
    );

  if (appState === "login_retrieval")
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-2xl space-y-10">
          <h2 className="text-center text-4xl font-black uppercase tracking-tighter text-[#004aad]">RETRIEVE CERTIFICATE</h2>
          <div className="space-y-6">
            <input type="email" placeholder="Email Address" className="input-field" value={retrievalData.email} onChange={(event) => setRetrievalData({ ...retrievalData, email: event.target.value })} />
            <input type="date" className="input-field" value={retrievalData.dob} onChange={(event) => setRetrievalData({ ...retrievalData, dob: event.target.value })} />
            {error && <div className="rounded-2xl bg-red-50 p-6 font-bold text-red-600">{error}</div>}
            <button onClick={handleRetrieval} disabled={loading} className="btn-primary w-full">SEARCH</button>
          </div>
        </div>
      </div>
    );

  if (appState === "consent")
    return (
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
          <button type="button" onClick={() => setAppState("registration")} className="btn-primary flex w-full items-center justify-center gap-2">
            <Lock className="h-6 w-6 shrink-0" />
            I AGREE AND CONTINUE
          </button>
        </div>
      </div>
    );

  if (appState === "registration")
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="card-senior w-full max-w-3xl space-y-12">
          <h1 className="text-center text-5xl font-black uppercase tracking-tighter text-[#004aad]">PARTICIPANT DATA</h1>
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
            <input type="email" className="input-field" placeholder="Email Address" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} />
            <input type="tel" className="input-field" placeholder="Phone Number" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
            <button
              onClick={() => {
                if (!formData.fullName || !formData.dob || !formData.email || !formData.gender) {
                  setError("Fill all fields including gender.");
                  return;
                }
                setError(null);
                setAppState("seminar");
              }}
              className="btn-primary w-full py-8 text-3xl font-black uppercase tracking-tighter"
            >
              Start Seminar
            </button>
          </div>
        </div>
      </div>
    );

  if (appState === "admin_dashboard")
    return (
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
                setAppState("landing");
              }}
              className="shrink-0 rounded-xl bg-white/20 px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-white/30"
            >
              Logout
            </button>
          </div>
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
                      No records loaded. Close and use Admin Portal with a valid code again.
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
    );

  return null;
}

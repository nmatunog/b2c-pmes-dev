import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  Landmark,
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
import { NarrativeCard } from "./components/NarrativeCard";
import { Certificate } from "./components/Certificate";
import { LOIForm } from "./components/LOIForm";
import { pcmToWav } from "./lib/audio";
import { auth, db, appId } from "./services/firebase";
import { PmesService } from "./services/pmesService";
import { requestTts } from "./services/ttsApi";
import { globalStyles } from "./styles/globalStyles";

const VOICE = "Aoede";

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
  const [audioLoading, setAudioLoading] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [masterList, setMasterList] = useState([]);
  const [examQuestions, setExamQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const audioCache = useRef({});
  const currentAudio = useRef(null);

  useEffect(() => {
    signInAnonymously(auth).catch(() => null);
    return onAuthStateChanged(auth, setUser);
  }, []);

  const playTts = async (text, cacheKey) => {
    if (isSpeaking) {
      currentAudio.current?.pause();
      setIsSpeaking(false);
      return;
    }
    if (audioCache.current[cacheKey]) {
      const audio = new Audio(audioCache.current[cacheKey]);
      currentAudio.current = audio;
      audio.onended = () => setIsSpeaking(false);
      setIsSpeaking(true);
      await audio.play();
      return;
    }

    setAudioLoading(true);
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
        wavUrl = URL.createObjectURL(
          pcmToWav(new Int16Array(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer)),
        );
      }
      audioCache.current[cacheKey] = wavUrl;
      const audio = new Audio(wavUrl);
      currentAudio.current = audio;
      audio.onended = () => setIsSpeaking(false);
      setIsSpeaking(true);
      await audio.play();
    } catch {
      setIsSpeaking(false);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleFinishExam = async () => {
    setLoading(true);
    const correct = examQuestions.reduce((sum, question, index) => sum + Number(answers[index] === question.c), 0);
    setScore(correct);
    try {
      const saved = await PmesService.saveRecord(db, appId, user, { ...formData, score: correct, passed: correct >= 7 });
      setActiveRecord({ ...formData, score: correct, id: saved.id, passed: correct >= 7, timestamp: new Date().toISOString() });
      setAppState("result");
    } catch {
      setError("Save failed.");
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
    try {
      const record = await PmesService.findRecord(db, appId, retrievalData.email, retrievalData.dob);
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
          <Landmark className="mx-auto h-24 w-24 text-[#004aad]" />
          <h1 className="text-6xl font-black uppercase tracking-tighter text-[#004aad]">B2C Consumers Cooperative</h1>
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
      <div className="min-h-screen px-8 py-16">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[4rem] bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-[#004aad] p-12 text-white">
            <div className="flex items-center gap-8">
              {(() => {
                const Icon = modules[currentStep].icon;
                return <Icon className="h-14 w-14" />;
              })()}
              <h2 className="text-4xl font-black uppercase tracking-tighter">{modules[currentStep].title}</h2>
            </div>
            <div className="rounded-full bg-black/20 px-6 py-2 text-2xl font-black tabular-nums">
              {currentStep + 1} / {modules.length}
            </div>
          </div>

          <div className="space-y-12 p-16">
            {modules[currentStep].items.map((item, index) => (
              <NarrativeCard
                key={item.t}
                index={index}
                title={item.t}
                outline={item.outline}
                script={item.script}
                isOpen={openCardIndex === index}
                onClick={() => setOpenCardIndex(index)}
                playTts={playTts}
                isSpeaking={isSpeaking}
                audioLoading={audioLoading}
              />
            ))}
          </div>

          <div className="flex gap-8 border-t-8 border-slate-50 bg-slate-50/50 p-12">
            <button
              disabled={currentStep === 0}
              onClick={() => {
                setCurrentStep((step) => step - 1);
                setOpenCardIndex(0);
                currentAudio.current?.pause();
                setIsSpeaking(false);
              }}
              className={`flex-1 rounded-[2.5rem] py-10 text-3xl font-black uppercase tracking-tighter ${
                currentStep === 0 ? "bg-slate-200 text-slate-400" : "bg-white text-slate-700 shadow-xl"
              }`}
            >
              Back
            </button>
            <button
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
              className="btn-primary flex-[2] py-10 text-3xl font-black uppercase tracking-tighter"
            >
              {currentStep === modules.length - 1 ? "Go to Exam" : "Next"}
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
        <div className="card-senior w-full max-w-4xl space-y-12 text-center">
          <div className={`mx-auto flex h-48 w-48 items-center justify-center rounded-full border-[12px] ${score >= 7 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
            {score >= 7 ? <CheckCircle2 className="h-24 w-24" /> : <AlertCircle className="h-24 w-24" />}
          </div>
          <h1 className="text-7xl font-black uppercase tracking-tighter text-[#004aad]">{score >= 7 ? "CONGRATS!" : "SO CLOSE!"}</h1>
          <p className="text-5xl font-black tracking-tighter text-slate-700">SCORE: {score} / 10</p>
          <button onClick={() => setAppState(score >= 7 ? "certificate" : "seminar")} className="btn-primary py-12 text-4xl uppercase tracking-tighter">
            {score >= 7 ? "View Certificate" : "Re-take"}
          </button>
        </div>
      </div>
    );

  if (appState === "certificate")
    return (
      <div className="flex min-h-screen flex-col items-center bg-slate-100 p-8 sm:p-20">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <Certificate record={activeRecord} />
        <div className="no-print mt-16 flex w-full max-w-4xl flex-col gap-8 sm:flex-row">
          <button onClick={() => window.print()} className="btn-secondary flex-1 py-8 text-2xl uppercase tracking-tighter"><Printer />Save as PDF</button>
          <button onClick={() => setAppState("loi_form")} className="btn-primary flex-1 py-8 text-2xl uppercase tracking-tighter"><Briefcase />Letter of Intent</button>
        </div>
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
        <div className="card-senior w-full max-w-4xl space-y-10 text-center">
          <ShieldAlert className="mx-auto h-24 w-24 animate-bounce text-[#004aad]" />
          <h1 className="text-5xl font-black uppercase tracking-tighter text-[#004aad]">PRIVACY AGREEMENT</h1>
          <button onClick={() => setAppState("registration")} className="btn-primary w-full"><Lock />I AGREE AND CONTINUE</button>
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
                if (!formData.fullName || !formData.dob || !formData.email) {
                  setError("Fill all fields!");
                  return;
                }
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
      <div className="min-h-screen bg-slate-50 p-12">
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[3rem] bg-white shadow-xl">
          <div className="flex items-center justify-between bg-[#004aad] p-10 text-white">
            <h1 className="text-3xl font-black uppercase">MASTER DATABASE</h1>
            <button onClick={() => setAppState("landing")} className="rounded-xl bg-white/20 px-6 py-2 font-bold uppercase tracking-widest">Logout</button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-sm uppercase tracking-widest text-slate-500">
              <tr><th className="p-6">Name</th><th className="p-6">Contact</th><th className="p-6">Score</th><th className="p-6 text-center">Action</th></tr>
            </thead>
            <tbody>
              {masterList.map((item) => (
                <tr key={item.id} className="border-t hover:bg-slate-50">
                  <td className="p-6 text-xl font-black">{item.fullName}</td>
                  <td className="p-6 text-slate-500">{item.email}</td>
                  <td className="p-6 text-2xl font-black">{item.score}/10</td>
                  <td className="p-6 text-center">
                    {item.passed && (
                      <button onClick={() => { setActiveRecord(item); setAppState("certificate"); }} className="text-[#004aad]">
                        <FileText className="h-10 w-10" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

  return null;
}

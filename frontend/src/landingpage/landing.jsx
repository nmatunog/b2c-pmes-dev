import { useState, useEffect } from "react";
import { B2CLogo } from "../components/B2CLogo.jsx";
import { COOPERATIVE_NAME, COOPERATIVE_REGION } from "../constants/cooperativeBrand.js";
import { BylawsModal } from "./BylawsModal.jsx";
import {
  Users,
  ShieldCheck,
  Menu,
  X,
  ArrowRight,
  LogIn,
  UserPlus,
  PlayCircle,
  Award,
  HeartHandshake,
  Coins,
  Quote,
  Building2,
  Rocket,
  History,
  Wallet,
  Download,
  GraduationCap,
  IdCard,
} from "lucide-react";

/** Primary bylaws PDF: place file at `frontend/public/documents/b2c-bylaws-primary.pdf`. */
const BYLAWS_PDF_URL = "/documents/b2c-bylaws-primary.pdf";

/**
 * B2C marketing landing (Vite: static assets live in `frontend/public/`, e.g. `BaiCommunityhome.png`).
 *
 * Member access uses Firebase **Email / Password** (configured in Firebase Console). PMES progress syncs to Firestore for resume.
 *
 * `resumePmesSuggested` — show “Continue PMES” when the member has unfinished PMES (any saved step) or paused mid-flow.
 */
export default function LandingPage({
  heroSrc = "/BaiCommunityhome.png",
  isFirebaseConfigured = true,
  authUser = null,
  resumePmesSuggested = false,
  /** True when the signed-in member has passed the PMES exam (score ≥ 7 or saved record). Used to gate LOI and payment steps. */
  pmesExamPassed = false,
  onJoinUs,
  onLogin,
  onLogout,
  onContinuePmes,
  onStartPmes,
  onRetrieveCertificate,
  onAdminPortal,
  onMemberProfile,
  onOpenLoi,
  onOpenPayment,
}) {
  const ACTUAL_MEMBER_COUNT = 27;
  const INITIAL_INVESTMENT = 1500;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const [memberPortalOpen, setMemberPortalOpen] = useState(false);
  const [orientationActive, setOrientationActive] = useState(false);
  const [orientationStep, setOrientationStep] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [privacyActive, setPrivacyActive] = useState(false);
  const [bylawsActive, setBylawsActive] = useState(false);
  const [pathGateMessage, setPathGateMessage] = useState(null);

  const [totalMembers] = useState(ACTUAL_MEMBER_COUNT);
  const [showNotification, setShowNotification] = useState(false);
  const [lastSignup, setLastSignup] = useState("Talamban, Cebu City");
  const [formattedYesterday, setFormattedYesterday] = useState("");

  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setFormattedYesterday(
      yesterday.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    );

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    const timer = setTimeout(() => {
      setShowNotification(true);
      const locations = ["Mandaue City", "Banilad", "Guadalupe", "Liloan", "Consolacion"];
      setLastSignup(locations[Math.floor(Math.random() * locations.length)]);
      setTimeout(() => setShowNotification(false), 5000);
    }, 20000);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!pathGateMessage) return undefined;
    const t = window.setTimeout(() => setPathGateMessage(null), 10000);
    return () => window.clearTimeout(t);
  }, [pathGateMessage]);

  /** Signed-in members go straight to the PMES entry; guests must use the member portal (sign up / sign in) first. */
  const continueToPmes = () => {
    if (authUser) {
      onStartPmes?.();
    } else {
      setPathGateMessage(null);
      setMemberPortalOpen(true);
    }
  };

  const retrieveCertificate = () => onRetrieveCertificate?.();

  const handleJoiningPathStep = (stepId) => {
    setPathGateMessage(null);
    if (!isFirebaseConfigured) {
      setPathGateMessage("Configure Firebase in frontend/.env to use member services.");
      return;
    }
    if (stepId === "pmes") {
      continueToPmes();
      return;
    }
    if (!authUser) {
      setMemberPortalOpen(true);
      return;
    }
    if (!pmesExamPassed) {
      setPathGateMessage(
        stepId === "loi"
          ? "Complete and pass the PMES exam before you can submit your Letter of Intent."
          : "Complete and pass the PMES exam before paying share capital and membership fees.",
      );
      return;
    }
    if (stepId === "loi") {
      onOpenLoi?.();
    } else if (stepId === "pay") {
      onOpenPayment?.();
    }
  };

  /** Guests go to the full login screen; signed-in members see the portal menu modal. */
  const openMemberPortal = () => {
    if (authUser) {
      setMemberPortalOpen(true);
    } else {
      setIsMenuOpen(false);
      onLogin?.();
    }
  };

  const orientationContent = [
    {
      title: "Redefine Your Experience",
      desc: "Welcome to B2C Consumers Cooperative. Imagine a world where you have the power to access, own, and control the best value products and services.",
      icon: <Users className="w-12 h-12" />,
      highlight: "Access • Ownership • Control",
    },
    {
      title: "The Rewards of Ownership",
      desc: "As a member, you aren't just a shopper. You enjoy Patronage Refunds on every purchase, Super Discounts, and annual Dividends on your share capital.",
      icon: <Wallet className="w-12 h-12" />,
      highlight: "Your Investment Grows for You",
    },
    {
      title: "Sustainable & Ethical",
      desc: "Our ambition goes beyond commerce. We source products with ethics in mind, ensuring a seamless shopping experience that makes a positive impact.",
      icon: <HeartHandshake className="w-12 h-12" />,
      highlight: "Leading Online Consumer Co-op",
    },
    {
      title: "Investment for Impact",
      desc: `To start, you'll need ₱500 for the annual fee and a minimum of ₱1,000 for your share capital. That's a ₱${INITIAL_INVESTMENT} total to kickstart your journey.`,
      icon: <Coins className="w-12 h-12" />,
      highlight: "Minimum 10 Shares (₱100/share)",
    },
    {
      title: "The Correct Path to Joining",
      desc: "Three steps to member-ownership — we guide you through each one in the app.",
      pathSteps: [
        { id: "pmes", label: "Complete the Pre-Membership Education Seminar (PMES) online." },
        { id: "loi", label: "Submit your Letter of Intent (LOI) through the member portal." },
        { id: "pay", label: "Pay your share capital and membership fee to become an owner." },
      ],
      icon: <Award className="w-12 h-12" />,
      highlight: "Orientation · Intent · Investment",
    },
  ];

  const content = {
    en: {
      shopBtn: "Start Shopping",
      orientationBtn: "Watch Interactive Intro",
      regNo: "CDA Reg. No. 9520-100700034930",
    },
    ceb: {
      shopBtn: "Sugod sa Pagpamalit",
      orientationBtn: "Tan-awa ang Interactive Intro",
      regNo: "CDA Reg. No. 9520-100700034930",
    },
  };

  const t = content[language];

  const PrivacyModal = () =>
    privacyActive && (
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setPrivacyActive(false)} />
        <div className="animate-in zoom-in-95 duration-200 relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl md:p-12">
          <button
            type="button"
            onClick={() => setPrivacyActive(false)}
            className="absolute right-6 top-6 rounded-full p-2 transition-colors hover:bg-slate-100"
          >
            <X />
          </button>
          <div className="mb-8 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Data Privacy Policy</h2>
          </div>
          <div className="space-y-6 font-medium leading-relaxed text-slate-600">
            <p className="text-xs font-black uppercase tracking-widest text-blue-600">Compliant with RA 10173 (Philippines)</p>
            <p>
              B2C Consumers Cooperative is committed to protecting your personal data. We collect information voluntarily provided
              during membership application and digital registration.
            </p>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Purpose of Collection</h4>
            <p>
              Your data is used to maintain the Registry of Members required by the CDA, facilitate online shopping, and calculate
              patronage refunds and dividends.
            </p>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Data Sharing</h4>
            <p>
              We do not sell your data. Sharing is limited to the Cooperative Development Authority (CDA) as required by law and
              delivery partners strictly for order fulfillment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPrivacyActive(false)}
            className="mt-12 w-full rounded-2xl bg-slate-900 py-4 font-black text-white shadow-xl"
          >
            Close Policy
          </button>
        </div>
      </div>
    );

  const MemberPortalModal = () =>
    memberPortalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMemberPortalOpen(false)} />
        <div className="animate-in zoom-in-95 duration-200 relative w-full max-w-md rounded-[32px] bg-white p-8 shadow-2xl">
          <button
            type="button"
            onClick={() => setMemberPortalOpen(false)}
            className="absolute right-6 top-6 rounded-full p-2 transition-colors hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mb-8 text-center">
            <B2CLogo size="sm" align="center" className="mb-5" />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Member portal</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {authUser ? (
                <span className="block truncate text-slate-700">{authUser.email}</span>
              ) : (
                "Create an account to begin PMES, or log in if you already have one."
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {!authUser && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMemberPortalOpen(false);
                    setIsMenuOpen(false);
                    onLogin?.();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700"
                >
                  <LogIn className="h-5 w-5 shrink-0" />
                  Sign in or register
                </button>
                <p className="text-center text-xs leading-snug text-slate-500">
                  Next screen: choose <span className="font-semibold text-slate-700">Sign in</span> or{" "}
                  <span className="font-semibold text-slate-700">Register</span>. Then use{" "}
                  <span className="font-semibold text-slate-700">Start PMES</span> when you&apos;re signed in.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMemberPortalOpen(false);
                    setIsMenuOpen(false);
                    onJoinUs?.();
                  }}
                  className="text-center text-sm font-bold text-blue-600 underline-offset-2 hover:underline"
                >
                  New member? Open registration tab
                </button>
              </>
            )}
            {authUser && resumePmesSuggested && onContinuePmes && (
              <button
                type="button"
                onClick={() => {
                  setMemberPortalOpen(false);
                  setIsMenuOpen(false);
                  onContinuePmes();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-black text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700"
              >
                Continue PMES
              </button>
            )}
            {authUser && onMemberProfile && (
              <button
                type="button"
                onClick={() => {
                  setMemberPortalOpen(false);
                  setIsMenuOpen(false);
                  onMemberProfile();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 font-black text-slate-800 transition-all hover:border-[#004aad]/40 hover:text-[#004aad]"
              >
                <IdCard className="h-5 w-5 shrink-0" />
                Member profile
              </button>
            )}
            {authUser ? (
              <button
                type="button"
                onClick={() => {
                  setMemberPortalOpen(false);
                  setIsMenuOpen(false);
                  continueToPmes();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700"
              >
                <PlayCircle className="h-5 w-5 shrink-0" />
                Start or restart PMES
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setMemberPortalOpen(false);
                setIsMenuOpen(false);
                retrieveCertificate();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 font-black text-slate-800 transition-all hover:border-blue-600 hover:text-blue-600"
            >
              <Download className="h-5 w-5 shrink-0" />
              My certificate
            </button>
            {authUser && (
              <button
                type="button"
                onClick={() => {
                  setMemberPortalOpen(false);
                  setIsMenuOpen(false);
                  onLogout?.();
                }}
                className="rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-500 hover:bg-slate-50"
              >
                Log out
              </button>
            )}
            <button
              type="button"
              onClick={() => setMemberPortalOpen(false)}
              className="py-2 text-center text-sm font-bold text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );

  const OrientationExperience = () =>
    orientationActive && (
      <div className="animate-in fade-in duration-300 fixed inset-0 z-[200] flex flex-col overflow-hidden bg-white">
        <div className="h-1.5 w-full shrink-0 bg-slate-100">
          <div
            className="h-full bg-blue-600 transition-all duration-700 ease-out"
            style={{ width: `${((orientationStep + 1) / orientationContent.length) * 100}%` }}
          />
        </div>
        <div className="flex shrink-0 items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <B2CLogo size="xs" className="h-8 max-w-[100px] shrink-0 sm:h-9" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Guided Intro</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setOrientationActive(false);
              setOrientationStep(0);
            }}
            className="rounded-full p-2 transition-colors hover:bg-slate-100"
          >
            <X className="h-6 w-6 text-slate-400" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
          <div key={orientationStep} className="animate-in slide-in-from-right duration-500 w-full max-w-2xl">
            <div className="mb-8 inline-block rounded-3xl bg-blue-50/50 p-6 text-blue-600">{orientationContent[orientationStep].icon}</div>
            <h2 className="mb-6 text-4xl font-black leading-tight tracking-tighter text-slate-900 md:text-6xl">
              {orientationContent[orientationStep].title}
            </h2>
            {orientationContent[orientationStep].pathSteps ? (
              <>
                <p className="mb-6 text-lg font-medium leading-relaxed text-slate-500 md:text-xl">
                  {orientationContent[orientationStep].desc}
                </p>
                {pathGateMessage ? (
                  <p
                    className="mx-auto mb-6 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-bold text-amber-950"
                    role="status"
                  >
                    {pathGateMessage}
                  </p>
                ) : null}
                <ol className="mx-auto mb-8 max-w-xl space-y-3 text-left">
                  {orientationContent[orientationStep].pathSteps.map((step, i) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => handleJoiningPathStep(step.id)}
                        className="group flex w-full gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/80 md:px-5 md:py-4"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
                          {i + 1}
                        </span>
                        <span className="pt-0.5 text-base font-medium leading-relaxed text-slate-700 md:text-lg">{step.label}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mb-8 text-lg font-medium leading-relaxed text-slate-500 md:text-xl">{orientationContent[orientationStep].desc}</p>
            )}
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white">
              {orientationContent[orientationStep].highlight}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-slate-100 bg-white p-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-8">
          <button
            type="button"
            onClick={() => setOrientationStep((s) => Math.max(0, s - 1))}
            disabled={orientationStep === 0}
            className={`self-start text-sm font-black transition-all ${
              orientationStep === 0 ? "invisible pointer-events-none h-0 overflow-hidden opacity-0 sm:h-auto" : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Back
          </button>
          {orientationStep === orientationContent.length - 1 && !authUser ? (
            <div className="flex w-full flex-1 flex-col gap-3 sm:max-w-xl sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setOrientationActive(false);
                  setOrientationStep(0);
                  onJoinUs?.();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-[0.99]"
              >
                <UserPlus className="h-5 w-5 shrink-0" />
                Create your account
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrientationActive(false);
                  setOrientationStep(0);
                  onLogin?.();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-6 py-4 text-base font-black text-slate-800 transition-all hover:border-blue-500 hover:text-blue-700"
              >
                <LogIn className="h-5 w-5 shrink-0" />
                Log in
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (orientationStep === orientationContent.length - 1) {
                  setOrientationActive(false);
                  setOrientationStep(0);
                  continueToPmes();
                } else {
                  setOrientationStep(orientationStep + 1);
                }
              }}
              className="w-full transform rounded-2xl bg-blue-600 px-8 py-4 font-black text-white shadow-xl transition-all active:scale-[0.99] sm:ml-auto sm:w-auto sm:rounded-full sm:px-10 sm:py-5"
            >
              {orientationStep === orientationContent.length - 1 ? "Continue to PMES" : "Continue"}
            </button>
          )}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen overflow-x-hidden bg-white pb-32 font-sans text-slate-900">
      <MemberPortalModal />
      <OrientationExperience />
      <PrivacyModal />
      <BylawsModal active={bylawsActive} onClose={() => setBylawsActive(false)} pdfUrl={BYLAWS_PDF_URL} />

      {showNotification && (
        <div className="animate-in slide-in-from-left-full duration-500 fixed bottom-10 left-6 z-[60]">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-black uppercase leading-none tracking-widest text-blue-400">Recent Activity</p>
              <p className="text-sm font-bold">{lastSignup}</p>
            </div>
          </div>
        </div>
      )}

      <nav
        className={`fixed left-0 top-0 z-50 w-full transition-all duration-300 ${
          scrolled ? "border-b border-slate-100 bg-white/70 py-3 backdrop-blur-xl" : "bg-transparent py-5"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <B2CLogo size="sm" className="shrink-0" />
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="text-sm font-black tracking-tight text-slate-900 sm:text-lg lg:text-xl">
                {COOPERATIVE_NAME}.
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-blue-600 sm:text-[10px] sm:tracking-[0.28em]">
                {COOPERATIVE_REGION}
              </span>
            </div>
          </div>
          <div className="hidden items-center space-x-8 text-sm font-bold lg:flex">
            <div className="flex items-center gap-2 text-slate-600">
              <History className="h-4 w-4 text-blue-600" />
              <span className="text-blue-600">{totalMembers} Members</span> as of {formattedYesterday}
            </div>
            <button
              type="button"
              onClick={() => setLanguage(language === "en" ? "ceb" : "en")}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"
            >
              {language.toUpperCase()}
            </button>
            <button type="button" onClick={openMemberPortal} className="text-slate-500 transition-colors hover:text-blue-600">
              Portal
            </button>
            {!authUser && (
              <button
                type="button"
                onClick={() => onLogin?.()}
                className="text-slate-500 transition-colors hover:text-blue-600"
              >
                Sign in
              </button>
            )}
            {authUser && (
              <button
                type="button"
                onClick={() => onLogout?.()}
                className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-blue-600"
              >
                Out
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onJoinUs?.();
                setIsMenuOpen(false);
              }}
              className="transform rounded-2xl bg-blue-600 px-8 py-3 text-sm font-black text-white shadow-xl shadow-blue-100 transition-all hover:-translate-y-0.5 hover:bg-blue-700"
            >
              {authUser ? "PMES" : "Sign up"}
            </button>
          </div>
          <button type="button" className="p-2 text-slate-600 lg:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-expanded={isMenuOpen}>
            <Menu />
          </button>
        </div>
        {isMenuOpen && (
          <div className="border-b border-slate-100 bg-white/95 px-4 py-4 shadow-lg backdrop-blur-xl lg:hidden">
            <div className="flex flex-col gap-3 text-sm font-bold">
              <div className="flex items-center gap-2 text-slate-600">
                <History className="h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  <span className="text-blue-600">{totalMembers} Members</span> as of {formattedYesterday}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLanguage(language === "en" ? "ceb" : "en")}
                className="w-full rounded-lg border border-slate-200 bg-slate-100 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                {language.toUpperCase()}
              </button>
              <button
                type="button"
                onClick={openMemberPortal}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-slate-700"
              >
                <LogIn className="h-4 w-4" />
                Portal
              </button>
              {!authUser && (
                <button type="button" onClick={() => onLogin?.()} className="rounded-xl border border-slate-200 py-3 text-slate-700">
                  Sign in
                </button>
              )}
              {authUser && (
                <button type="button" onClick={() => onLogout?.()} className="rounded-xl border border-slate-200 py-3 text-slate-500">
                  Log out
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onJoinUs?.();
                  setIsMenuOpen(false);
                }}
                className="rounded-xl bg-blue-600 py-3 font-black text-white shadow-lg"
              >
                {authUser ? "PMES" : "Sign up"}
              </button>
            </div>
          </div>
        )}
      </nav>

      <section className="relative overflow-hidden bg-white pb-12 pt-[5.25rem] sm:pt-24 lg:pt-[6.5rem]">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          {!isFirebaseConfigured && (
            <div className="mb-6 w-full max-w-4xl rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-amber-950 sm:mb-8">
              Firebase is not configured — add VITE_FIREBASE_* keys in frontend/.env to enable member accounts.
            </div>
          )}

          {authUser && resumePmesSuggested && onContinuePmes && (
            <div
              className="mb-8 w-full max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-md sm:mb-10 sm:px-5 sm:py-4 lg:mb-12"
              role="status"
            >
              <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
                <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-emerald-900 sm:text-base">
                  You have PMES progress saved. Continue where you left off.
                </p>
                <button
                  type="button"
                  onClick={onContinuePmes}
                  className="shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition-colors hover:bg-emerald-700 sm:py-3"
                >
                  Continue PMES
                </button>
              </div>
            </div>
          )}

          <div className="animate-in slide-in-from-top-4 duration-1000 mb-10 inline-flex items-center gap-2 rounded-full border border-blue-100/50 bg-blue-50 px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" /> Established Excellence • Para sa Sugbo
          </div>
          <h1 className="mb-8 max-w-5xl text-5xl font-black leading-[0.9] tracking-tighter text-slate-900 drop-shadow-sm md:text-8xl">
            Shop Smarter. <span className="text-blue-600">Grow Together.</span>
          </h1>
          <p className="mb-12 max-w-2xl text-lg font-medium leading-relaxed text-slate-500 md:text-2xl">
            Join Visayas&apos; first{" "}
            <span className="font-bold text-slate-900 underline decoration-4 decoration-blue-200">digital-led</span> consumers
            cooperative. Owned by you, built for the community.
          </p>
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                setOrientationStep(0);
                setOrientationActive(true);
              }}
              className="group flex transform items-center justify-center gap-4 rounded-[32px] bg-blue-600 px-12 py-6 text-xl font-black text-white shadow-2xl shadow-blue-100 transition-all hover:-translate-y-1 hover:bg-blue-700"
            >
              <PlayCircle className="h-7 w-7" /> {t.orientationBtn}
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-[32px] border-2 border-slate-200 bg-white px-12 py-6 text-xl font-black text-slate-900 transition-all hover:border-blue-600 hover:text-blue-600"
            >
              {t.shopBtn}
            </button>
          </div>
          <div className="mb-20 w-full">
            {!authUser ? (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
                <span className="text-sm font-semibold text-slate-500">Ready for PMES?</span>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => onJoinUs?.()}
                    className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-slate-800"
                  >
                    Sign up free
                  </button>
                  <button
                    type="button"
                    onClick={() => onLogin?.()}
                    className="rounded-full border-2 border-slate-300 bg-white px-6 py-2.5 text-sm font-black text-slate-800 transition hover:border-blue-500"
                  >
                    Log in
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="animate-in fade-in zoom-in-95 duration-1000 w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-50/50 shadow-inner">
            <img
              src={heroSrc}
              alt="B2C cooperative marketplace — community stalls and the B2C COOP shop"
              className="h-auto max-h-[min(22rem,42vh)] w-full object-contain object-center drop-shadow-xl md:max-h-[26rem]"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/50 py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {[
            { label: "Digital Pioneers", val: "First", sub: "In Visayas", icon: <Rocket className="h-5 w-5 text-blue-600" /> },
            { label: "Legitimacy", val: "CDA Reg", sub: "Oct 2023", icon: <ShieldCheck className="h-5 w-5 text-blue-600" /> },
            { label: "Verified Count", val: totalMembers, sub: `As of ${formattedYesterday}`, icon: <History className="h-5 w-5 text-blue-600" /> },
            { label: "Ownership", val: `₱${INITIAL_INVESTMENT}`, sub: "Minimum Entry", icon: <Building2 className="h-5 w-5 text-blue-600" /> },
          ].map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-3xl border border-slate-100/50 bg-white p-6 shadow-sm transition-all hover:translate-y-[-4px]"
            >
              <div className="shrink-0 rounded-2xl bg-blue-50 p-3">{s.icon}</div>
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-600">{s.label}</p>
                <p className="text-2xl font-black tracking-tighter text-slate-900">{s.val}</p>
                <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative bg-slate-900 py-32 text-white">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-20 px-4 sm:px-6 lg:flex-row lg:px-8">
          <div className="lg:w-1/2">
            <h2 className="mb-8 text-4xl font-black leading-tight tracking-tighter md:text-6xl">
              Ready to become <br />
              <span className="text-blue-500">an owner?</span>
            </h2>
            <div className="space-y-6">
              {[
                { step: "01", title: "Complete PMES", desc: "Watch the online orientation to understand your rights." },
                { step: "02", title: "Submit LOI", desc: "Submit your digital Letter of Intent through our portal." },
                { step: "03", title: "Secure Shares", desc: `Invest ₱${INITIAL_INVESTMENT} to unlock dividends and refunds.` },
              ].map((s, i) => (
                <div key={i} className="group flex gap-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-black text-blue-500 transition-all group-hover:bg-blue-600 group-hover:text-white">
                    {s.step}
                  </div>
                  <div>
                    <h4 className="mb-1 text-xl font-black">{s.title}</h4>
                    <p className="text-sm font-medium text-slate-400">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-1/2">
            <div className="relative overflow-hidden rounded-[48px] bg-white p-8 text-slate-900 shadow-2xl sm:p-12">
              <Quote className="absolute right-8 top-8 h-12 w-12 text-blue-50 opacity-10" />
              <p className="text-xs font-black uppercase tracking-widest text-blue-600">Pre-Membership Education</p>
              <h3 className="mt-3 text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
                Ready to join now?
              </h3>
              <p className="mt-4 text-lg font-medium leading-relaxed text-slate-600">
                {authUser ? (
                  <>
                    You&apos;re signed in. Continue to the privacy notice and PMES modules, or open the member portal any time.
                  </>
                ) : (
                  <>
                    Create your member login, then take the interactive PMES. You&apos;ll accept the privacy notice before the
                    modules begin.
                  </>
                )}
              </p>
              {authUser ? (
                <button
                  type="button"
                  onClick={continueToPmes}
                  className="group mt-8 flex w-full items-center justify-center gap-2 rounded-3xl bg-slate-900 py-5 text-lg font-black text-white shadow-xl transition-all hover:bg-slate-800"
                >
                  Continue to PMES <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
                </button>
              ) : (
                <>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <button
                      type="button"
                      onClick={() => onJoinUs?.()}
                      className="group flex flex-1 items-center justify-center gap-2 rounded-3xl bg-slate-900 py-4 text-base font-black text-white shadow-xl transition-all hover:bg-slate-800 sm:py-5 sm:text-lg"
                    >
                      <UserPlus className="h-5 w-5 shrink-0" />
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => onLogin?.()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-3xl border-2 border-slate-300 bg-white py-4 text-base font-black text-slate-800 transition-all hover:border-blue-500 sm:py-5 sm:text-lg"
                    >
                      <LogIn className="h-5 w-5 shrink-0" />
                      Log in
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={continueToPmes}
                    className="mt-3 w-full text-center text-sm font-bold text-blue-600 underline-offset-2 hover:underline"
                  >
                    Already have an account? Continue to PMES (sign in)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white py-24">
        <div className="mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="col-span-1">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <B2CLogo size="md" className="shrink-0" />
              <div className="min-w-0 flex flex-col leading-tight">
                <span className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{COOPERATIVE_NAME}.</span>
                <span className="text-sm font-bold uppercase tracking-widest text-blue-600">{COOPERATIVE_REGION}</span>
              </div>
            </div>
            <p className="mb-8 text-lg font-medium leading-relaxed text-slate-500">
              Elevating standards of living through Access, Ownership, Control, and Opportunities.
            </p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 px-4 text-[10px] font-black uppercase leading-none tracking-widest text-slate-400">
              <ShieldCheck className="h-4 w-4 text-blue-600" /> {t.regNo}
            </div>
          </div>
          <div className="space-y-6">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Governance</h5>
            <ul className="space-y-4 text-sm font-bold text-slate-500">
              <li>
                <button type="button" onClick={() => setPrivacyActive(true)} className="transition-colors hover:text-blue-600">
                  Data Privacy Policy
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setBylawsActive(true)} className="transition-colors hover:text-blue-600">
                  By-Laws
                </button>
              </li>
              <li>
                <button type="button" className="transition-colors hover:text-blue-600">
                  Member Charter
                </button>
              </li>
              {onAdminPortal && (
                <li>
                  <button type="button" onClick={() => onAdminPortal()} className="transition-colors hover:text-blue-600">
                    Admin portal
                  </button>
                </li>
              )}
            </ul>
          </div>
          <div className="space-y-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <p>© 2026 {COOPERATIVE_NAME}.</p>
            <p>Cebu City, Philippines.</p>
            <div className="mt-8 flex gap-4">
              <button type="button" className="text-blue-600">
                Facebook
              </button>
              <button type="button" className="text-blue-600">
                Viber
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

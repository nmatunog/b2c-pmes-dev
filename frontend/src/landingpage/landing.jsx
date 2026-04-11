import { useState, useEffect } from "react";
import { B2CLogo } from "../components/B2CLogo.jsx";
import { COOPERATIVE_NAME, COOPERATIVE_REGION } from "../constants/cooperativeBrand.js";
import { PRIVACY_NOTICE_HEADING, PRIVACY_NOTICE_PARAGRAPHS } from "../constants/privacyAgreement.js";
import { BylawsModal } from "./BylawsModal.jsx";
import { LandingFaqAssistant } from "./LandingFaqAssistant.jsx";
import { pickRandomActivityMessage } from "./cebuActivityMock.js";
import { SIGNUP_LIVE_ACTIVITY_KEY } from "../lib/signupLiveActivity.js";
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
  /** True when the line is the visitor’s own post-signup activity (device area), not mock FOMO. */
  const [activityIsYou, setActivityIsYou] = useState(false);
  /** Full mock line e.g. "New signup from IT Park" — Cebu-wide random (see cebuActivityMock.js). */
  const [activityLine, setActivityLine] = useState(() => pickRandomActivityMessage());
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

    const TOAST_MS = 6500;
    const SIGNUP_TOAST_MS = 9000;
    const FIRST_DELAY_MS = 6000 + Math.floor(Math.random() * 4000);
    const MOCK_AFTER_SIGNUP_EXTRA_MS = 32000;
    const BETWEEN_MIN_MS = 28000;
    const BETWEEN_MAX_MS = 52000;

    const timeouts = [];

    const formatSignupLine = (area) =>
      area
        ? `New signup near ${area} — that's you. Welcome aboard!`
        : `Your signup just hit the feed — welcome aboard!`;

    const showSignupToast = (area) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setActivityIsYou(true);
      setActivityLine(formatSignupLine(area));
      setShowNotification(true);
      timeouts.push(
        window.setTimeout(() => {
          setShowNotification(false);
          setActivityIsYou(false);
        }, SIGNUP_TOAST_MS),
      );
    };

    /** Read session queue from App after signup (location may resolve asynchronously). */
    const tryConsumeSignupLiveActivity = () => {
      try {
        const raw = sessionStorage.getItem(SIGNUP_LIVE_ACTIVITY_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data.pending === true) return false;
        if (data.source !== "signup") return false;
        if (Date.now() - data.at > 30 * 60 * 1000) {
          sessionStorage.removeItem(SIGNUP_LIVE_ACTIVITY_KEY);
          return false;
        }
        sessionStorage.removeItem(SIGNUP_LIVE_ACTIVITY_KEY);
        showSignupToast(data.area ?? null);
        return true;
      } catch {
        try {
          sessionStorage.removeItem(SIGNUP_LIVE_ACTIVITY_KEY);
        } catch {
          /* noop */
        }
        return false;
      }
    };

    const pollSignupUntilReady = () => {
      if (tryConsumeSignupLiveActivity()) return;
      try {
        const raw = sessionStorage.getItem(SIGNUP_LIVE_ACTIVITY_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.pending !== true) return;
      } catch {
        return;
      }
      timeouts.push(
        window.setTimeout(() => {
          if (tryConsumeSignupLiveActivity()) return;
          pollSignupUntilReady();
        }, 450),
      );
    };

    const hadSignup = tryConsumeSignupLiveActivity();
    if (!hadSignup) pollSignupUntilReady();

    const showOneToast = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setActivityIsYou(false);
      setActivityLine(pickRandomActivityMessage());
      setShowNotification(true);
      timeouts.push(
        window.setTimeout(() => {
          setShowNotification(false);
        }, TOAST_MS),
      );
    };

    const scheduleNext = () => {
      const gap = BETWEEN_MIN_MS + Math.floor(Math.random() * (BETWEEN_MAX_MS - BETWEEN_MIN_MS));
      timeouts.push(
        window.setTimeout(() => {
          showOneToast();
          scheduleNext();
        }, gap),
      );
    };

    const mockKickoff = hadSignup ? FIRST_DELAY_MS + MOCK_AFTER_SIGNUP_EXTRA_MS : FIRST_DELAY_MS;
    timeouts.push(
      window.setTimeout(() => {
        showOneToast();
        scheduleNext();
      }, mockKickoff),
    );

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Math.random() < 0.35) {
          setActivityLine(pickRandomActivityMessage());
        }
        tryConsumeSignupLiveActivity();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      timeouts.forEach((id) => window.clearTimeout(id));
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
      shopBtn: "See what we offer",
      orientationBtn: "Take the 5‑minute intro",
      regNo: "CDA Reg. No. 9520-100700034930",
    },
    ceb: {
      shopBtn: "Tan-awa ang among storya",
      orientationBtn: "Sugdi ang mubo nga intro",
      regNo: "CDA Reg. No. 9520-100700034930",
    },
  };

  const t = content[language];

  const PrivacyModal = () =>
    privacyActive && (
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" onClick={() => setPrivacyActive(false)} />
        <div className="animate-in zoom-in-95 duration-200 relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-stone-200/80 bg-white p-8 shadow-2xl shadow-stone-900/10 md:p-10">
          <button
            type="button"
            onClick={() => setPrivacyActive(false)}
            className="absolute right-5 top-5 rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900 md:text-3xl">{PRIVACY_NOTICE_HEADING}</h2>
          </div>
          <div className="space-y-5 text-[15px] leading-relaxed text-stone-600">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">RA 10173 (Philippines)</p>
            {PRIVACY_NOTICE_PARAGRAPHS.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPrivacyActive(false)}
            className="mt-10 w-full rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-stone-800"
          >
            Close
          </button>
        </div>
      </div>
    );

  const MemberPortalModal = () =>
    memberPortalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" onClick={() => setMemberPortalOpen(false)} />
        <div className="animate-in zoom-in-95 duration-200 relative w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-8 shadow-2xl shadow-stone-900/10">
          <button
            type="button"
            onClick={() => setMemberPortalOpen(false)}
            className="absolute right-5 top-5 rounded-full p-2 text-stone-500 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mb-8 text-center">
            <B2CLogo size="sm" align="center" className="mb-5" />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">Member portal</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
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
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/15 transition-all hover:bg-blue-700"
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
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700"
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
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-200 bg-white py-3.5 text-sm font-semibold text-stone-800 transition-all hover:border-blue-500/50 hover:text-blue-800"
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
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700"
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
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-200 bg-white py-3.5 text-sm font-semibold text-stone-800 transition-all hover:border-blue-500 hover:text-blue-700"
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
                className="rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
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
      <div className="animate-in fade-in duration-300 fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#faf9f6]">
        <div className="h-1 w-full shrink-0 bg-stone-200">
          <div
            className="h-full bg-blue-600 transition-all duration-700 ease-out"
            style={{ width: `${((orientationStep + 1) / orientationContent.length) * 100}%` }}
          />
        </div>
        <div className="flex shrink-0 items-center justify-between px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center gap-3">
            <B2CLogo size="xs" className="h-8 max-w-[100px] shrink-0 sm:h-9" />
            <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Guided intro</span>
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
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-8 text-center sm:px-6">
          <div key={orientationStep} className="animate-in slide-in-from-right duration-500 w-full max-w-2xl">
            <div className="mb-6 inline-block rounded-3xl bg-blue-50 p-5 text-blue-600 sm:mb-8 sm:p-6">
              {orientationContent[orientationStep].icon}
            </div>
            <h2 className="mb-5 text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:mb-6 sm:text-4xl md:text-5xl">
              {orientationContent[orientationStep].title}
            </h2>
            {orientationContent[orientationStep].pathSteps ? (
              <>
                <p className="mb-6 text-base font-normal leading-relaxed text-stone-600 sm:text-lg md:text-xl">
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
                        className="group flex w-full gap-4 rounded-2xl border border-stone-200/80 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 md:px-5 md:py-4"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 transition group-hover:bg-blue-600 group-hover:text-white">
                          {i + 1}
                        </span>
                        <span className="pt-0.5 text-[15px] leading-relaxed text-stone-700 md:text-base">{step.label}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mb-8 text-base leading-relaxed text-stone-600 sm:text-lg md:text-xl">{orientationContent[orientationStep].desc}</p>
            )}
            <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full bg-stone-800/95 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-white/95">
              {orientationContent[orientationStep].highlight}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-stone-200/80 bg-white/95 p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-8">
          <button
            type="button"
            onClick={() => setOrientationStep((s) => Math.max(0, s - 1))}
            disabled={orientationStep === 0}
            className={`self-start text-sm font-medium transition-all ${
              orientationStep === 0 ? "invisible pointer-events-none h-0 overflow-hidden opacity-0 sm:h-auto" : "text-stone-500 hover:text-stone-800"
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
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.99]"
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
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 bg-white px-6 py-3.5 text-base font-semibold text-stone-800 transition-all hover:border-blue-400 hover:text-blue-800"
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
              className="w-full rounded-2xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all active:scale-[0.99] sm:ml-auto sm:w-auto sm:rounded-full sm:px-10 sm:py-4"
            >
              {orientationStep === orientationContent.length - 1 ? "Continue to PMES" : "Continue"}
            </button>
          )}
        </div>
      </div>
    );

  return (
    <div
      id="top"
      className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#f6f4f0] via-[#f8f7f4] to-[#ebe8e2] pb-24 font-sans text-stone-900 sm:pb-28"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-stone-900 focus:shadow-lg focus:ring-2 focus:ring-blue-500"
      >
        Skip to main content
      </a>
      <MemberPortalModal />
      <OrientationExperience />
      <PrivacyModal />
      <BylawsModal active={bylawsActive} onClose={() => setBylawsActive(false)} pdfUrl={BYLAWS_PDF_URL} />
      <LandingFaqAssistant language={language} onOpenBylaws={() => setBylawsActive(true)} />

      {showNotification && (
        <div
          className="animate-in slide-in-from-left-full fade-in duration-500 fixed bottom-6 left-4 right-4 z-[90] sm:bottom-10 sm:left-6 sm:right-auto sm:max-w-md"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-slate-950/90 p-3.5 text-white shadow-2xl shadow-blue-950/40 backdrop-blur-2xl backdrop-saturate-150 sm:items-center sm:gap-4 sm:p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/30">
              <Users className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase leading-none tracking-widest text-sky-300">Live activity</p>
                {activityIsYou ? (
                  <span className="rounded-full bg-sky-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-200 ring-1 ring-sky-400/40">
                    You
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-semibold leading-snug text-white/95">{activityLine}</p>
            </div>
          </div>
        </div>
      )}

      <nav
        className={`fixed left-0 top-0 z-50 w-full transition-all duration-300 ${
          scrolled ? "glass-nav-scrolled py-3" : "glass-nav py-4 sm:py-5"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <B2CLogo size="sm" className="shrink-0" />
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="truncate text-sm font-bold tracking-tight text-stone-900 sm:text-base lg:text-lg">
                {COOPERATIVE_NAME}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600 sm:text-[11px]">
                {COOPERATIVE_REGION}
              </span>
            </div>
          </a>
          <div className="hidden items-center gap-6 text-sm font-medium lg:flex xl:gap-8">
            <div className="hidden items-center gap-1.5 text-stone-600 xl:flex">
              <History className="h-4 w-4 shrink-0 text-blue-600/90" aria-hidden />
              <span>
                <span className="font-bold text-stone-900">{totalMembers}</span>{" "}
                <span className="text-stone-600">members · {formattedYesterday}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLanguage(language === "en" ? "ceb" : "en")}
              className="rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/70"
            >
              {language.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={openMemberPortal}
              className="font-medium text-stone-700 transition-colors hover:text-blue-700"
            >
              Portal
            </button>
            {!authUser && (
              <button type="button" onClick={() => onLogin?.()} className="font-medium text-stone-700 transition-colors hover:text-blue-700">
                Sign in
              </button>
            )}
            {authUser && (
              <button type="button" onClick={() => onLogout?.()} className="text-xs font-semibold text-stone-500 hover:text-blue-700">
                Log out
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onJoinUs?.();
                setIsMenuOpen(false);
              }}
              className="rounded-full bg-gradient-to-b from-blue-600 to-blue-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-blue-600"
            >
              {authUser ? "PMES" : "Join us"}
            </button>
          </div>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-stone-600 lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            <Menu className="mx-auto" />
          </button>
        </div>
        {isMenuOpen && (
          <div className="border-b border-white/50 bg-white/80 px-4 py-4 shadow-lg shadow-stone-900/10 backdrop-blur-2xl backdrop-saturate-150 lg:hidden">
            <div className="flex flex-col gap-2 text-sm font-medium">
              <div className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-stone-600">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  <span className="font-semibold text-stone-800">{totalMembers}</span> members · {formattedYesterday}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLanguage(language === "en" ? "ceb" : "en")}
                className="w-full rounded-full border border-stone-200 bg-stone-50 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
              >
                {language.toUpperCase()}
              </button>
              <button
                type="button"
                onClick={openMemberPortal}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-stone-700"
              >
                <LogIn className="h-4 w-4" />
                Portal
              </button>
              {!authUser && (
                <button
                  type="button"
                  onClick={() => onLogin?.()}
                  className="min-h-[44px] rounded-xl border border-stone-200 py-2.5 text-stone-700"
                >
                  Sign in
                </button>
              )}
              {authUser && (
                <button type="button" onClick={() => onLogout?.()} className="min-h-[44px] rounded-xl border border-stone-200 py-2.5 text-stone-500">
                  Log out
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onJoinUs?.();
                  setIsMenuOpen(false);
                }}
                className="min-h-[48px] rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 py-3 font-bold text-white shadow-lg shadow-blue-600/25"
              >
                {authUser ? "PMES" : "Join us"}
              </button>
            </div>
          </div>
        )}
      </nav>

      <main id="main-content">
      <section className="mesh-hero relative overflow-hidden pb-14 pt-[5rem] sm:pb-16 sm:pt-[5.5rem] lg:pt-[6.25rem]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-blue-400/25 blur-3xl sm:h-80 sm:w-80" aria-hidden />
          <div className="absolute -right-16 top-40 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl sm:h-72 sm:w-72" aria-hidden />
        </div>
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          {!isFirebaseConfigured && (
            <div className="mb-6 w-full max-w-4xl rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-950 sm:mb-8">
              Member sign-in needs Firebase: add <code className="rounded bg-amber-100/80 px-1">VITE_FIREBASE_*</code> in{" "}
              <code className="rounded bg-amber-100/80 px-1">frontend/.env</code>.
            </div>
          )}

          {authUser && resumePmesSuggested && onContinuePmes && (
            <div
              className="mb-8 w-full max-w-3xl rounded-2xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3.5 text-left shadow-sm sm:mb-10 sm:px-5 sm:py-4 lg:mb-12"
              role="status"
            >
              <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
                <p className="min-w-0 flex-1 text-sm leading-snug text-emerald-900 sm:text-base">
                  <span className="font-semibold">Pick up where you left off</span> — your PMES progress is saved.
                </p>
                <button
                  type="button"
                  onClick={onContinuePmes}
                  className="shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 sm:min-h-[44px] sm:px-6"
                >
                  Continue PMES
                </button>
              </div>
            </div>
          )}

          <p className="glass-badge animate-in fade-in slide-in-from-top-2 duration-700 mb-6 inline-flex max-w-md flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full px-4 py-2.5 text-xs font-semibold text-stone-700 sm:mb-8 sm:text-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
            <span>CDA-registered co-op</span>
            <span className="text-stone-300" aria-hidden>
              ·
            </span>
            <span>Cebu · member-owned</span>
          </p>
          <h1 className="mb-5 max-w-3xl text-[2rem] font-extrabold leading-[1.12] tracking-tight text-stone-900 sm:mb-6 sm:text-4xl md:text-5xl lg:max-w-4xl lg:text-[3.25rem]">
            Shop smarter,{" "}
            <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-teal-600 bg-clip-text text-transparent">
              together
            </span>
          </h1>
          <p className="mb-10 max-w-xl text-base font-medium leading-relaxed text-stone-600 sm:mb-12 sm:text-lg md:max-w-2xl md:text-xl">
            We&apos;re a digital-first consumers cooperative in the Visayas — real ownership, fair value, and a community that
            grows with you. No pressure: explore first, join when you&apos;re ready.
          </p>
          <div className="mb-10 flex w-full max-w-lg flex-col gap-3 sm:mb-12 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            <button
              type="button"
              onClick={() => {
                setOrientationStep(0);
                setOrientationActive(true);
              }}
              className="group flex min-h-[52px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-8 py-3.5 text-base font-bold text-white shadow-xl shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:min-h-[56px] sm:px-10 sm:text-lg"
            >
              <PlayCircle className="h-6 w-6 shrink-0 opacity-95" aria-hidden /> {t.orientationBtn}
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("at-a-glance")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="glass-cta-secondary flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-base font-bold text-stone-800 transition-all hover:bg-white/60 sm:min-h-[56px] sm:px-10 sm:text-lg"
            >
              {t.shopBtn}
            </button>
          </div>
          <div className="mb-12 w-full sm:mb-14">
            {!authUser ? (
              <div className="glass-card mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl px-4 py-4 sm:max-w-none sm:flex-row sm:justify-center sm:gap-6 sm:px-6 sm:py-4">
                <p className="text-sm font-medium text-stone-700">Thinking about PMES?</p>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
                  <button
                    type="button"
                    onClick={() => onJoinUs?.()}
                    className="min-h-[44px] rounded-full bg-gradient-to-b from-stone-800 to-stone-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-stone-900/20 transition hover:from-stone-700 hover:to-stone-800"
                  >
                    Create free account
                  </button>
                  <button
                    type="button"
                    onClick={() => onLogin?.()}
                    className="min-h-[44px] rounded-full border border-white/60 bg-white/50 px-6 py-2.5 text-sm font-bold text-stone-800 shadow-sm backdrop-blur-sm transition hover:bg-white/70"
                  >
                    I already have one
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="glass-hero-frame w-full max-w-5xl overflow-hidden rounded-2xl sm:rounded-3xl">
            <img
              src={heroSrc}
              alt="B2C cooperative marketplace — community stalls and the B2C COOP shop"
              className="h-auto max-h-[min(20rem,38vh)] w-full object-contain object-center sm:max-h-[min(24rem,42vh)] md:max-h-[26rem]"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </section>

      <section
        id="at-a-glance"
        className="mesh-stats relative border-y border-white/40 py-14 sm:py-16"
        aria-labelledby="at-a-glance-heading"
      >
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="at-a-glance-heading" className="mb-8 text-center text-sm font-bold tracking-wide text-stone-600 sm:mb-10 sm:text-base">
            At a glance
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Where we lead", val: "First", sub: "Digital-led co-op in Visayas", icon: <Rocket className="h-5 w-5 text-blue-600" /> },
              { label: "Registered", val: "CDA", sub: "Since Oct 2023", icon: <ShieldCheck className="h-5 w-5 text-blue-600" /> },
              { label: "Members", val: totalMembers, sub: `Updated ${formattedYesterday}`, icon: <History className="h-5 w-5 text-blue-600" /> },
              { label: "Starting share + fee", val: `₱${INITIAL_INVESTMENT}`, sub: "Typical first step (see PMES)", icon: <Building2 className="h-5 w-5 text-blue-600" /> },
            ].map((s, i) => (
              <div
                key={i}
                className="glass-card glass-card-hover flex items-start gap-4 rounded-2xl p-5 sm:p-6"
              >
                <div className="shrink-0 rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 p-3 ring-1 ring-blue-100/90">{s.icon}</div>
                <div className="min-w-0 text-left">
                  <p className="mb-0.5 text-xs font-semibold text-stone-600">{s.label}</p>
                  <p className="text-2xl font-extrabold tracking-tight text-stone-950">{s.val}</p>
                  <p className="mt-1 text-xs font-medium leading-snug text-stone-600">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="your-path" className="mesh-path relative py-16 text-white sm:py-24 lg:py-28" aria-labelledby="path-heading">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-stretch gap-12 px-4 sm:px-6 lg:flex-row lg:items-start lg:gap-16 lg:px-8">
          <div className="lg:w-1/2 lg:pt-2">
            <h2 id="path-heading" className="mb-6 text-3xl font-extrabold leading-tight tracking-tight text-white sm:mb-8 sm:text-4xl md:text-5xl">
              Your path to{" "}
              <span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">membership</span>
            </h2>
            <p className="mb-8 max-w-lg text-base font-medium leading-relaxed text-stone-300/95 sm:text-lg">
              Three clear steps — we walk you through each one in the app. Take your time; there&apos;s no rush to decide.
            </p>
            <div className="space-y-5">
              {[
                { step: "1", title: "PMES", desc: "Short online orientation so you know your rights and how co-ops work." },
                { step: "2", title: "Letter of intent", desc: "Submit through the member portal when you are ready." },
                { step: "3", title: "Share payment", desc: `Minimum ₱${INITIAL_INVESTMENT} to open your share (details in PMES).` },
              ].map((s, i) => (
                <div key={i} className="group flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/12 text-sm font-bold text-sky-200 shadow-inner shadow-blue-950/30 backdrop-blur-sm transition-colors group-hover:border-sky-400/35 group-hover:bg-blue-500/25">
                    {s.step}
                  </div>
                  <div>
                    <h4 className="mb-0.5 text-lg font-bold text-white">{s.title}</h4>
                    <p className="text-sm font-medium leading-relaxed text-stone-400">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-1/2">
            <div className="glass-path-card relative overflow-hidden rounded-3xl p-7 text-stone-900 sm:p-10">
              <Quote className="pointer-events-none absolute right-6 top-6 h-10 w-10 text-blue-200/80 sm:h-12 sm:w-12" aria-hidden />
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Pre-membership education</p>
              <h3 className="mt-2 text-xl font-extrabold leading-snug text-stone-900 sm:text-2xl">Start when it feels right</h3>
              <p className="mt-3 text-base leading-relaxed text-stone-600">
                {authUser ? (
                  <>You&apos;re signed in — continue to PMES from here or use the portal anytime.</>
                ) : (
                  <>
                    Create a free login, then take the interactive PMES. You&apos;ll see the privacy notice before the lessons — nothing
                    hidden, no small print ambush.
                  </>
                )}
              </p>
              {authUser ? (
                <button
                  type="button"
                  onClick={continueToPmes}
                  className="group mt-8 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-stone-800 to-stone-950 py-4 text-base font-bold text-white shadow-xl shadow-stone-900/40 transition-all hover:from-stone-700 hover:to-stone-900"
                >
                  Continue to PMES <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
                </button>
              ) : (
                <>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <button
                      type="button"
                      onClick={() => onJoinUs?.()}
                      className="group flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-stone-800 to-stone-950 py-3.5 text-base font-bold text-white shadow-xl shadow-stone-900/35 transition-all hover:from-stone-700 hover:to-stone-900 sm:py-4"
                    >
                      <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => onLogin?.()}
                      className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/85 py-3.5 text-base font-bold text-stone-800 shadow-md backdrop-blur-sm transition-all hover:bg-white sm:py-4"
                    >
                      <LogIn className="h-5 w-5 shrink-0" aria-hidden />
                      Log in
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={continueToPmes}
                    className="mt-4 w-full text-center text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
                  >
                    Already registered? Continue to PMES
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
      </main>

      <footer className="glass-footer py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 md:grid-cols-3 md:gap-14 lg:px-8">
          <div className="col-span-1">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <B2CLogo size="md" className="shrink-0" />
              <div className="min-w-0 flex flex-col leading-tight">
                <span className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">{COOPERATIVE_NAME}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">{COOPERATIVE_REGION}</span>
              </div>
            </div>
            <p className="mb-6 max-w-sm text-base leading-relaxed text-stone-600">
              Better access, fair ownership, and opportunities for our members — online-first, grounded in Cebu.
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/50 bg-white/55 px-3 py-2 text-[11px] font-semibold leading-snug text-stone-600 shadow-sm backdrop-blur-md">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" aria-hidden /> {t.regNo}
            </div>
          </div>
          <div className="space-y-4">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Governance</h5>
            <ul className="space-y-3 text-sm font-medium text-stone-600">
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
          <div className="space-y-4 text-sm text-stone-600">
            <p className="text-xs text-stone-500">© {new Date().getFullYear()} {COOPERATIVE_NAME}</p>
            <p className="text-stone-600">Cebu City, Philippines</p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button type="button" className="text-sm font-medium text-blue-700 hover:underline">
                Facebook
              </button>
              <button type="button" className="text-sm font-medium text-blue-700 hover:underline">
                Viber
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

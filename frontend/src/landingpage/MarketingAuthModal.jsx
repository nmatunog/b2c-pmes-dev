import { useEffect, useId, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2, LogIn, UserPlus, X } from "lucide-react";
import { auth, isFirebaseConfigured } from "../services/firebase.js";
import { signupWithEmailPasswordAndNeonSync } from "../services/memberSignupNeon.js";
import { resolveFirebaseLoginEmail } from "../services/resolveFirebaseLoginEmail.js";

function firebaseAuthMessage(code) {
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

/**
 * Email/password sign-in or sign-up on the marketing landing (stays on the page).
 * Sign-in accepts email, callsign, member ID, or alternate label (same resolution as `App.jsx`).
 * Sign-up uses the same Neon handshake as `App.jsx` via {@link signupWithEmailPasswordAndNeonSync}.
 */
export function MarketingAuthModal({
  open,
  view,
  onClose,
  onSwitchView,
  onOpenPrivacy,
  onSignupSuccess,
  onOpenFullMemberAuth,
}) {
  const formId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncHint, setSyncHint] = useState(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSyncHint(null);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [view, open]);

  if (!open || !view) return null;

  const isSignup = view === "signup";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!isFirebaseConfigured || !auth) {
      setError("Firebase is not configured. Add VITE_FIREBASE_* to frontend/.env.");
      return;
    }
    setLoading(true);
    setSyncHint(null);
    try {
      if (isSignup) {
        if (!agreed) {
          setError("Please agree to the Data Privacy Policy.");
          setLoading(false);
          return;
        }
        setSyncHint("Saving your membership record…");
        await signupWithEmailPasswordAndNeonSync(auth, {
          email: email.trim(),
          password,
          fullName: fullName.trim(),
        });
        onSignupSuccess?.();
        onClose();
      } else {
        const resolved = await resolveFirebaseLoginEmail(email.trim(), "signin");
        if (!resolved.ok) {
          setError(resolved.message);
          return;
        }
        await signInWithEmailAndPassword(auth, resolved.email, password);
        onClose();
      }
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
      if (typeof code === "string" && code.startsWith("auth/")) {
        setError(firebaseAuthMessage(code));
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError(firebaseAuthMessage(undefined));
      }
    } finally {
      setLoading(false);
      setSyncHint(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="animate-in zoom-in-95 relative w-full max-w-md rounded-[2rem] border border-stone-200/80 bg-white p-8 shadow-2xl shadow-stone-900/10 duration-200 md:p-10"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
            {isSignup ? <UserPlus className="h-7 w-7" aria-hidden /> : <LogIn className="h-7 w-7" aria-hidden />}
          </div>
          <h2 id={`${formId}-title`} className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
            {isSignup ? "Create your account" : "Sign in"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            {isSignup
              ? "Quick registration — you’ll continue to consent and PMES in the app."
              : "Use your email, callsign, member ID, or alternate label — same as the full member sign-in."}
          </p>
        </div>

        {error ? (
          <div
            className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isSignup ? (
            <div>
              <label htmlFor={`${formId}-name`} className="mb-1.5 block text-xs font-semibold text-stone-600">
                Full name
              </label>
              <input
                id={`${formId}-name`}
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-stone-900 outline-none ring-blue-500/0 transition-shadow focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                placeholder="As you’d like it on records"
              />
            </div>
          ) : null}
          <div>
            <label htmlFor={`${formId}-email`} className="mb-1.5 block text-xs font-semibold text-stone-600">
              {isSignup ? "Email" : "Email, callsign, or member ID"}
            </label>
            <input
              id={`${formId}-email`}
              name="email"
              type={isSignup ? "email" : "text"}
              autoComplete={isSignup ? "email" : "username"}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isSignup ? "" : "e.g. you@domain.com or your callsign"}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-stone-900 outline-none transition-shadow focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-password`} className="mb-1.5 block text-xs font-semibold text-stone-600">
              Password
            </label>
            <input
              id={`${formId}-password`}
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-stone-900 outline-none transition-shadow focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {isSignup ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-left text-xs leading-snug text-stone-600">
                I agree to the{" "}
                <button
                  type="button"
                  className="font-semibold text-blue-700 underline-offset-2 hover:underline"
                  onClick={() => onOpenPrivacy?.()}
                >
                  Data Privacy Policy
                </button>{" "}
                (RA 10173).
              </span>
            </label>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-blue-600 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            {isSignup ? "Create account & continue" : "Sign in"}
          </button>
          {syncHint ? (
            <p className="text-center text-xs font-semibold text-blue-700 animate-pulse" role="status">
              {syncHint}
            </p>
          ) : null}
        </form>

        <div className="mt-6 space-y-3 border-t border-stone-100 pt-6 text-center text-sm">
          <button
            type="button"
            className="font-semibold text-blue-700 hover:underline"
            onClick={() => onSwitchView?.(isSignup ? "login" : "signup")}
          >
            {isSignup ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
          {typeof onOpenFullMemberAuth === "function" ? (
            <p className="text-xs leading-relaxed text-stone-500">
              <button
                type="button"
                className="font-medium text-stone-700 underline-offset-2 hover:underline"
                onClick={() => {
                  onClose();
                  onOpenFullMemberAuth(isSignup ? "signup" : "login");
                }}
              >
                Open full member registration
              </button>
              <span className="block mt-1">(extended form, pioneer flow, and portal options)</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

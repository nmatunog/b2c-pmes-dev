import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { requestLandingChat } from "../services/landingChatApi.js";
import {
  LANDING_FAQ_ASSISTANT,
  LANDING_FAQ_ITEMS,
  matchLandingFaq,
} from "./landingFaqData.js";
import { ctaPrimary, ctaPrimaryFocus, faqHeaderBar, faqUserBubble } from "./brandCta.js";

const hasApiBase = () => Boolean((import.meta.env.VITE_API_BASE_URL || "").trim());

/** Renders `**bold**` segments as <strong>. */
function FormattedAnswer({ text }) {
  const parts = String(text).split(/\*\*/);
  return (
    <p className="text-[14px] leading-relaxed text-stone-700">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-stone-900">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

/**
 * Fixed FAQ “chatbot” on the marketing landing (branded **Ka-uban**): scripted FAQ + keyword match first;
 * optional Gemini text via `POST /ai/landing-chat` when `LANDING_CHAT_PROVIDER=gemini` on the API.
 *
 * @param {{ language?: 'en' | 'ceb', onOpenBylaws?: () => void }} props
 */
export function LandingFaqAssistant({ language = "en", onOpenBylaws }) {
  const lang = language === "ceb" ? "ceb" : "en";
  const strings = LANDING_FAQ_ASSISTANT[lang];
  const panelId = useId();
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const listEndRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [messages, setMessages] = useState(() => [
    { role: "bot", key: "welcome", text: strings.welcome },
  ]);

  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages, scrollToBottom]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector("input")?.focus();
    }, 100);
    return () => window.clearTimeout(t);
  }, [open]);

  const pushExchange = (userText, answerText) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", key: `u-${Date.now()}`, text: userText },
      { role: "bot", key: `b-${Date.now()}`, text: answerText },
    ]);
  };

  const answerForItem = (item) => (lang === "ceb" ? item.ceb.a : item.en.a);
  const questionForItem = (item) => (lang === "ceb" ? item.ceb.q : item.en.q);

  const handlePickFaq = (item) => {
    pushExchange(questionForItem(item), answerForItem(item));
    setInput("");
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || aiLoading) return;
    const hit = matchLandingFaq(q);
    if (hit) {
      pushExchange(q, answerForItem(hit));
      setInput("");
      return;
    }

    if (!hasApiBase()) {
      pushExchange(q, strings.apiUnavailable);
      setInput("");
      return;
    }

    setAiLoading(true);
    try {
      const result = await requestLandingChat({ message: q, language: lang });
      if (result.ok) {
        pushExchange(q, result.text);
      } else if (result.disabled) {
        pushExchange(q, strings.aiDisabled);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NO_API_BASE") {
        pushExchange(q, strings.apiUnavailable);
      } else {
        pushExchange(q, strings.aiError);
      }
    } finally {
      setAiLoading(false);
      setInput("");
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-4 z-[92] flex flex-col items-end gap-3 sm:bottom-8 sm:right-6">
      <div
        ref={panelRef}
        id={panelId}
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-labelledby={open ? `${panelId}-title` : undefined}
        className={`pointer-events-auto max-h-[min(72vh,520px)] w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white/95 shadow-2xl shadow-stone-900/15 backdrop-blur-xl ${
          open ? "flex" : "hidden"
        }`}
        aria-hidden={!open}
      >
        <div className={`flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 py-3.5 text-white shadow-inner shadow-black/5 ${faqHeaderBar}`}>
          <div className="min-w-0">
            <h2 id={`${panelId}-title`} className="text-sm font-bold leading-tight">
              {strings.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              btnRef.current?.focus();
            }}
            className="shrink-0 rounded-full p-1.5 text-white/90 transition-colors hover:bg-white/15"
            aria-label={strings.closeLabel}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.map((m) => (
            <div
              key={m.key}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 ${
                  m.role === "user"
                    ? `text-[14px] font-medium leading-relaxed ${faqUserBubble}`
                    : "bg-stone-100 text-stone-800"
                }`}
              >
                {m.role === "user" ? (
                  <p className="text-[14px] leading-relaxed">{m.text}</p>
                ) : (
                  <FormattedAnswer text={m.text} />
                )}
              </div>
            </div>
          ))}
          <div ref={listEndRef} />
        </div>

        <div className="shrink-0 border-t border-stone-100 bg-stone-50/80 px-3 py-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-stone-500">{strings.chipHint}</p>
          <div className="mb-3 flex gap-2 overflow-x-auto overflow-y-hidden pb-1 [-webkit-overflow-scrolling:touch]">
            {LANDING_FAQ_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePickFaq(item)}
                className="line-clamp-2 min-h-[48px] max-w-[min(100%,14rem)] shrink-0 rounded-xl border border-indigo-100/90 bg-gradient-to-br from-white to-sky-50/80 px-3.5 py-2.5 text-left text-[11px] font-semibold leading-snug text-indigo-950 shadow-sm transition-colors hover:border-sky-300 hover:from-sky-50 hover:to-cyan-50/80 hover:text-indigo-950"
              >
                {questionForItem(item)}
              </button>
            ))}
          </div>
          {onOpenBylaws ? (
            <button
              type="button"
              onClick={() => {
                onOpenBylaws();
                setOpen(false);
              }}
              className="mb-2 w-full rounded-xl border border-indigo-100 bg-white py-2.5 text-center text-xs font-semibold text-indigo-900 transition-colors hover:border-sky-400 hover:bg-sky-50/80 hover:text-indigo-950"
            >
              {lang === "ceb" ? "Tan-awa ang primary By-Laws" : "Open primary By-Laws"}
            </button>
          ) : null}
          <div className="flex gap-2">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              {strings.placeholder}
            </label>
            <input
              id={`${panelId}-input`}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={strings.placeholder}
              disabled={aiLoading}
              className="min-h-[48px] flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={aiLoading}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-70 ${ctaPrimary} ${ctaPrimaryFocus}`}
              aria-label={strings.send}
            >
              {aiLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-xl shadow-indigo-900/25 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${ctaPrimary} ${ctaPrimaryFocus}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? strings.closeLabel : strings.openLabel}
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <MessageCircle className="h-6 w-6" aria-hidden />}
      </button>
    </div>
  );
}

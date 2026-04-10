import { MessageCircle, Volume2 } from "lucide-react";
import { KaubanAvatarHead } from "./KaubanAvatarHead";

const STORAGE_KEY = "b2c-pmes-course-audio";

export function readCourseAudioPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v !== "0";
  } catch {
    return true;
  }
}

export function writeCourseAudioPreference(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function OptionCard({ selected, onClick, title, description, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full flex-col items-center gap-3 rounded-2xl border-2 p-4 text-center transition-all sm:flex-row sm:items-center sm:text-left ${
        selected
          ? "border-[#004aad] bg-white shadow-md shadow-[#004aad]/15"
          : "border-slate-200 bg-white/80 hover:border-[#004aad]/40 hover:bg-white"
      }`}
    >
      <KaubanAvatarHead sizeClass="h-12 w-12 sm:h-14 sm:w-14" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <Icon className={`h-5 w-5 shrink-0 ${selected ? "text-[#004aad]" : "text-slate-500"}`} aria-hidden />
          <span className="font-bold text-slate-900">{title}</span>
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-600">{description}</p>
      </div>
    </button>
  );
}

/**
 * Ask whether the participant wants voice narration or text-only; same Ka-uban head for both options.
 */
export function CourseAudioPreference({ enabled, onChange }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 sm:p-6">
      <h3 className="text-lg font-bold text-slate-900">How would you like Ka-uban to guide you?</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Do you prefer <span className="font-semibold text-slate-800">voice narration</span> (each section read aloud) or{" "}
        <span className="font-semibold text-slate-800">text only</span> (script beside each section, no sound)? You can
        change this anytime.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <OptionCard
          selected={enabled}
          onClick={() => onChange(true)}
          title="With voice"
          description="Ka-uban reads each section aloud. Best when you can listen comfortably."
          icon={Volume2}
        />
        <OptionCard
          selected={!enabled}
          onClick={() => onChange(false)}
          title="Without voice"
          description="Text guide only — Ka-uban’s script types beside each section. Good for quiet spaces."
          icon={MessageCircle}
        />
      </div>
    </div>
  );
}

import { Volume2, VolumeX } from "lucide-react";

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

/**
 * Course-wide toggle: voice narration vs text-only (talking head + typewriter, no TTS).
 */
export function CourseAudioPreference({ enabled, onChange }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="font-bold text-slate-900">Narration for this course</p>
        <p className="text-sm leading-snug text-slate-600">
          {enabled
            ? "Ka-uban reads each section aloud. Turn off for a quiet room — you will see text next to the slide instead."
            : "Text-only mode: Ka-uban appears beside each section with the script typing out. No sound."}
        </p>
      </div>
      <div className="flex items-center gap-3 self-start sm:self-center">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {enabled ? (
            <>
              <Volume2 className="h-5 w-5 text-[#004aad]" aria-hidden />
              Voice on
            </>
          ) : (
            <>
              <VolumeX className="h-5 w-5 text-slate-500" aria-hidden />
              Text only
            </>
          )}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? "Switch to text-only mode" : "Switch voice narration on"}
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-9 w-[3.25rem] shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004aad] ${
            enabled ? "bg-[#004aad]" : "bg-slate-300"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-8 w-8 translate-x-0.5 rounded-full bg-white shadow transition ${
              enabled ? "translate-x-[1.35rem]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

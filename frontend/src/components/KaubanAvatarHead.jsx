/** Shared Ka-uban portrait for guide card + narration preference (same asset everywhere). */
export const KAUBAN_AVATAR_SRC = "/kauban-avatar.png";

/**
 * Single ring frame (PMES blue) — no ring-offset / inner padding (avoids “double frame”).
 */
export function KaubanAvatarHead({ sizeClass = "h-10 w-10", className = "" }) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full bg-white shadow-md shadow-[#004aad]/20 ring-2 ring-[#004aad] ${className}`}
    >
      <img
        src={KAUBAN_AVATAR_SRC}
        alt=""
        width={40}
        height={40}
        className={`aspect-square object-cover ${sizeClass}`}
        decoding="async"
        loading="lazy"
      />
    </div>
  );
}

/** Robot-style tail; explicit fill + block sizing so it always paints above the card. */
export function KaubanSpeechTail({ className = "" }) {
  return (
    <svg
      className={`block shrink-0 text-[#004aad] ${className}`}
      viewBox="0 0 48 16"
      aria-hidden
      focusable="false"
    >
      <path fill="currentColor" d="M8 0 Q24 14 40 0 Q44 4 40 8 Q24 18 8 8 Q4 4 8 0Z" />
    </svg>
  );
}

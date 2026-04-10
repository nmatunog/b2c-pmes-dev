/**
 * Official B2C wordmark (`public/b2c-logo.png`) for nav bars, cards, and in-app chrome.
 */
const SIZE_CLASS = {
  xs: "h-7 max-w-[120px]",
  sm: "h-9 max-w-[160px] sm:h-10",
  md: "h-10 max-w-[180px] sm:h-11",
  lg: "h-12 max-w-[200px] sm:h-14",
  /** Certificate / hero */
  xl: "h-28 max-w-[260px] sm:h-32 sm:max-w-[280px]",
};

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} [props.size]
 * @param {'default' | 'center'} [props.align] — `center` adds `mx-auto` for stacked hero layouts
 */
export function B2CLogo({ className = "", size = "md", align = "default" }) {
  const alignClass = align === "center" ? "mx-auto" : "";
  return (
    <img
      src="/b2c-logo.png"
      alt="B2C Consumers Cooperative"
      className={`w-auto object-contain object-left ${SIZE_CLASS[size] ?? SIZE_CLASS.md} ${alignClass} ${className}`.trim()}
      width={220}
      height={88}
      decoding="async"
    />
  );
}

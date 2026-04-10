/**
 * Turn raw PDF text into display segments (headings vs paragraphs).
 * PDF extraction is noisy; we normalize whitespace and infer structure from common patterns.
 */

/** Lines typical of signature blocks — omit names while keeping cooperative wording. */
const SIGNATURE_LINE =
  /^(?:name|signature|signed|date|witness|notary|per\s+doc|id\s+no\.?|tin|sss|philhealth)\s*[.:]/i;
const LOOKS_LIKE_NAME_LINE =
  /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*[,–-]?\s*(?:Chair|President|Secretary|Treasurer|Director|Member|Cooperator)/i;

/**
 * Drop trailing signature / attestation blocks from extracted text (names often appear there).
 */
export function redactSignatoryAppendix(text) {
  const markers = [
    /\n\s*CERTIFICATE\s+OF\s+/i,
    /\n\s*SIGNATORIES?\s*[:\n]/i,
    /\n\s*SIGNATURE\s+PAGE/i,
    /\n\s*ACKNOWLEDGMENT/i,
    /\n\s*NOTARIAL/i,
  ];
  let cut = text.length;
  for (const re of markers) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }
  const trimmed = text.slice(0, cut).trimEnd();
  return trimmed.length > 200 ? trimmed : text;
}

function normalizeRaw(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function mergeBrokenLines(lines) {
  const out = [];
  let buf = "";
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      continue;
    }
    if (!buf) {
      buf = t;
      continue;
    }
    const prevEnds = /[.!?:;)\]"']$/.test(buf);
    const nextIsHeader =
      /^(ARTICLE|SECTION|CHAPTER|PART)\s+/i.test(t) ||
      (t === t.toUpperCase() && t.length < 90 && t.length > 4 && /[A-Z]/.test(t));
    const nextContinues = /^[a-z(]/.test(t) || /^[,;]/.test(t);
    if (!prevEnds && nextContinues && !nextIsHeader) {
      buf = `${buf} ${t}`;
    } else {
      out.push(buf);
      buf = t;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function isHeading(line) {
  const t = line.trim();
  if (t.length < 4 || t.length > 120) return false;
  if (/^(ARTICLE|SECTION|CHAPTER|PART)\s+[IVXLCDM0-9A-Z.-]+/i.test(t)) return true;
  if (/^SECTION\s+\d+/i.test(t)) return true;
  if (t === t.toUpperCase() && /[A-Z]/.test(t) && !/^\d+$/.test(t)) return true;
  return false;
}

/**
 * @param {string} raw
 * @returns {{ type: 'h2' | 'h3' | 'p', text: string }[]}
 */
export function parseBylawsToSegments(raw) {
  const cleaned = redactSignatoryAppendix(normalizeRaw(raw));
  const lines = cleaned.split("\n").map((l) => l.trim());
  const merged = mergeBrokenLines(lines.filter(Boolean));

  /** @type {{ type: 'h2' | 'h3' | 'p', text: string }[]} */
  const segments = [];
  for (const line of merged) {
    if (SIGNATURE_LINE.test(line) || LOOKS_LIKE_NAME_LINE.test(line)) continue;
    if (isHeading(line)) {
      const level = /^ARTICLE|^CHAPTER|^PART/i.test(line) ? "h2" : "h3";
      segments.push({ type: level, text: line });
    } else {
      segments.push({ type: "p", text: line });
    }
  }
  return segments;
}

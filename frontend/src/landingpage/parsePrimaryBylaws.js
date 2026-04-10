/**
 * Parse official B2C primary bylaws plain text into UI segments.
 * Expects: title block, preamble, then "Article N" + optional subtitle line, "Section N." headings, paragraphs.
 * Standalone 1–2 digit lines (PDF page numbers) are dropped.
 */

/** @typedef {{ type: 'h1' | 'h2' | 'h3' | 'p', text: string }} BylawSegment */

const PAGE_NUM_ONLY = /^\d{1,2}$/;

/**
 * @param {string} raw
 * @returns {BylawSegment[]}
 */
export function parsePrimaryBylawsPlaintext(raw) {
  const cut = raw.split(/\nVoted and adopted this\b/i)[0].trim();
  const lines = cut.split("\n").map((l) => l.trim());

  /** @type {BylawSegment[]} */
  const out = [];
  let i = 0;

  const pushTitleBlock = () => {
    if (lines[i] === "BY-LAWS" && lines[i + 1] === "OF" && lines[i + 2]?.startsWith("B2C Consumers")) {
      out.push({ type: "h1", text: `BY-LAWS OF ${lines[i + 2]}` });
      i += 3;
      return true;
    }
    if (/^BY-LAWS\s+OF\s+B2C/i.test(lines[i] || "")) {
      out.push({ type: "h1", text: lines[i] });
      i += 1;
      return true;
    }
    return false;
  };

  if (!pushTitleBlock()) {
    out.push({ type: "h1", text: "BY-LAWS OF B2C Consumers Cooperative" });
  }

  while (i < lines.length) {
    let line = lines[i];
    if (!line) {
      i += 1;
      continue;
    }
    if (PAGE_NUM_ONLY.test(line)) {
      i += 1;
      continue;
    }

    const articleM = line.match(/^Article\s+([IVXLCDM]+)\s*$/i);
    if (articleM) {
      let title = `Article ${articleM[1]}`;
      i += 1;
      if (i < lines.length && lines[i] && !/^Section\s+\d/i.test(lines[i]) && !/^Article\s+[IVXLCDM]+\s*$/i.test(lines[i])) {
        title += ` — ${lines[i]}`;
        i += 1;
      }
      out.push({ type: "h2", text: title });
      continue;
    }

    if (/^Section\s+\d+/i.test(line)) {
      out.push({ type: "h3", text: line });
      i += 1;
      continue;
    }

    let buf = line;
    i += 1;
    while (i < lines.length) {
      const L = lines[i];
      if (!L) break;
      if (PAGE_NUM_ONLY.test(L)) {
        i += 1;
        continue;
      }
      if (/^Article\s+[IVXLCDM]+\s*$/i.test(L)) break;
      if (/^Section\s+\d+/i.test(L)) break;
      buf += ` ${L}`;
      i += 1;
    }
    out.push({ type: "p", text: buf });
  }

  return out;
}

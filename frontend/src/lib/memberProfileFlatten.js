/**
 * Dot-path flatten for CSV / JSON export (nested plain objects + arrays of objects).
 * @param {Record<string, unknown>} obj
 * @param {string} [prefix]
 * @returns {Array<[string, string]>}
 */
export function flattenProfilePaths(obj, prefix = "") {
  /** @type {Array<[string, string]>} */
  const out = [];
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const p = prefix ? `${prefix}[${i}]` : `[${i}]`;
      if (item !== null && typeof item === "object") {
        out.push(...flattenProfilePaths(item, p));
      } else {
        out.push([p, String(item ?? "")]);
      }
    });
    return out;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v)) {
        out.push(...flattenProfilePaths(v, p));
      } else if (v !== null && typeof v === "object") {
        out.push(...flattenProfilePaths(v, p));
      } else {
        out.push([p, String(v ?? "")]);
      }
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} profile
 * @returns {string} CSV text
 */
export function profileToCsvString(profile) {
  const rows = flattenProfilePaths(profile);
  const lines = [["field", "value"], ...rows].map((r) =>
    r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
  );
  return lines.join("\n");
}

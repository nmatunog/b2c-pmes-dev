/**
 * Count pipeline rows by cooperative stage for staff inbox prompts (Treasurer / BOD / Secretary).
 * Mirrors `toLifecyclePayload` stages in the API.
 */
export function countMembershipInboxByStage(rows) {
  const out = { treasurer: 0, bod: 0, secretary: 0 };
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    const st = String(r.stage || "");
    if (st === "AWAITING_PAYMENT") out.treasurer += 1;
    else if (st === "AWAITING_BOD_VOTE") out.bod += 1;
    else if (st === "AWAITING_SECRETARY_RESOLUTION") out.secretary += 1;
  }
  return out;
}

/**
 * @param {string | null} role — staff JWT role
 * @param {{ treasurer: number; bod: number; secretary: number }} counts
 * @returns {null | { lines: string[] }}
 */
export function staffPipelineInboxSummary(role, counts) {
  if (!role || !counts) return null;
  const lines = [];
  const isTreasurer = role === "treasurer";
  const isBod = role === "board_director";
  const isSecretary = role === "secretary";
  const isAdmin = role === "admin" || role === "superuser";

  if (isAdmin || isTreasurer) {
    if (counts.treasurer > 0) {
      lines.push(
        `${counts.treasurer} member application${counts.treasurer === 1 ? "" : "s"} need fee confirmation (Treasurer).`,
      );
    }
  }
  if (isAdmin || isBod) {
    if (counts.bod > 0) {
      lines.push(
        `${counts.bod} member application${counts.bod === 1 ? "" : "s"} need Board of Directors approval votes.`,
      );
    }
  }
  if (isAdmin || isSecretary) {
    if (counts.secretary > 0) {
      lines.push(
        `${counts.secretary} member application${counts.secretary === 1 ? "" : "s"} need Secretary resolution and final Board approval.`,
      );
    }
  }

  if (lines.length === 0) return null;
  return { lines };
}

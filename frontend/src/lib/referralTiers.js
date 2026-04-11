import { PUBLIC_MEMBER_COUNT } from "../constants/cooperativeBrand.js";

/** Pioneer Points earned per successful owner join via the member’s link. */
export const PIONEER_POINTS_PER_JOIN = 50;

/**
 * Count-based reward tiers (successful joins).
 * L1: Co-op Badge → Recognized Pioneer · L2: Assembly VIP · L3: Founder Award
 */
export const COUNT_REWARD_TIERS = [
  {
    level: 1,
    threshold: 10,
    shortLabel: "10 Invites",
    reward: "Co-op Badge",
    recognition: "Recognized Pioneer",
  },
  {
    level: 2,
    threshold: 50,
    shortLabel: "50 Invites",
    reward: "Assembly VIP",
    recognition: "Priority seating / recognition at AGM",
  },
  {
    level: 3,
    threshold: 100,
    shortLabel: "100 Invites",
    reward: "Founder Award",
    recognition: "Highest tier for growth",
  },
];

/**
 * Highest tier fully unlocked by `count` (for messaging).
 * @param {number} count
 */
export function getHighestTierUnlocked(count) {
  const n = Number(count) || 0;
  let best = null;
  for (const t of COUNT_REWARD_TIERS) {
    if (n >= t.threshold) best = t;
  }
  return best;
}

/**
 * Leaderboard-style label from points (illustrative until API ranks members).
 * @param {number} points
 */
export function getLeaderboardStatusFromPoints(points) {
  const p = Number(points) || 0;
  if (p >= 300) return { label: "Elite", tone: "text-amber-600" };
  if (p >= 100) return { label: "Active", tone: "text-[#004aad]" };
  if (p > 0) return { label: "Rising", tone: "text-emerald-600" };
  return { label: "New", tone: "text-slate-500" };
}

/**
 * Approximate “Top X%” vs the cooperative member pool (placeholder logic).
 * Replace with server-side percentile when leaderboard data exists.
 * @param {number} points
 * @param {number} [poolSize]
 */
export function getApproxPercentileLabel(points, poolSize = PUBLIC_MEMBER_COUNT) {
  const p = Number(points) || 0;
  if (p <= 0) return null;
  if (p >= 400) return "Top 5%";
  if (p >= 200) return "Top 15%";
  if (p >= 80) return "Top 25%";
  return "Top 50%";
}

/**
 * Edge SQL often SELECTs columns added in later Prisma migrations. If production has not applied
 * a migration yet, Postgres returns undefined_column — detect and retry with a slimmer SELECT.
 *
 * Covers: `memberProfileConcurrencyStamp`, BOD workflow (`bodMajorityReachedAt`, `boardResolutionNo`).
 */
export function isMissingMemberProfileStampColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : "";
  const optional =
    /memberProfileConcurrencyStamp/i.test(msg) ||
    /bodMajorityReachedAt/i.test(msg) ||
    /boardResolutionNo/i.test(msg);
  if (!optional) return false;
  return (
    code === "42703" ||
    /does not exist/i.test(msg) ||
    /undefined column/i.test(msg) ||
    /column .* does not exist/i.test(msg)
  );
}

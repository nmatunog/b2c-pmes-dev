/**
 * Edge routes SELECT/UPDATE `memberProfileConcurrencyStamp` after Prisma migration. If production DB
 * has not run the migration yet, Postgres errors — detect and retry without the column (stamp = 0).
 */
export function isMissingMemberProfileStampColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return (
    /42703/.test(msg) ||
    /column\s+"?memberProfileConcurrencyStamp"?\s+does not exist/i.test(msg) ||
    (msg.includes("memberProfileConcurrencyStamp") && /does not exist/i.test(msg))
  );
}

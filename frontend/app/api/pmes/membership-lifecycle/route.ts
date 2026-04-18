import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import {
  ensureMemberPublicId,
  noParticipantLifecycle,
  toLifecyclePayload,
} from "@/lib/pmes-edge/lifecycle";
import { normalizeEmail } from "@/lib/pmes-edge/norm";
import { loadParticipantWithRelsByEmail } from "@/lib/pmes-edge/queries";
import { fetchReferralRewards } from "@/lib/referral-edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = String(searchParams.get("email") ?? "").trim();
  if (!raw) {
    return NextResponse.json({ message: "email query parameter is required", statusCode: 400 }, { status: 400 });
  }

  const email = normalizeEmail(raw);
  const sql = getSql();

  const participant = await loadParticipantWithRelsByEmail(sql, email);
  if (!participant) {
    return NextResponse.json(noParticipantLifecycle(email));
  }

  try {
    const withId = await ensureMemberPublicId(sql, participant);
    const base = toLifecyclePayload(withId);
    const referralRewards = await fetchReferralRewards(sql, withId.id);
    return NextResponse.json({ ...base, referralRewards });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Membership lifecycle failed";
    if (msg.includes("Could not allocate a unique member ID")) {
      return NextResponse.json({ message: msg, statusCode: 500 }, { status: 500 });
    }
    return NextResponse.json({ message: msg, statusCode: 500 }, { status: 500 });
  }
}

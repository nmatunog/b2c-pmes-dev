import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLoiDto } from "./dto/create-loi.dto";
import { CreatePmesDto } from "./dto/create-pmes.dto";
import { SubmitFullProfileDto } from "./dto/submit-full-profile.dto";
import type { ImportLegacyPioneerRowDto } from "./dto/import-legacy-pioneers.dto";
import type { PioneerEligibilityDto } from "./dto/pioneer-eligibility.dto";
import { UpdateParticipantMembershipDto } from "./dto/update-participant-membership.dto";
import {
  computeAlternatePublicHandle,
  normalizeLastNameKey,
  validateAndNormalizeCallsignInput,
} from "./callsign.util";
import { asObject, deriveFromMemberProfile, parseFullProfileEnvelope } from "./member-profile.extract";
import {
  buildMemberPublicId,
  cohortYYFromDob,
  initialsFromFirstLast,
  initialsFromFullName,
} from "./member-public-id";
import type { LoiSubmission, Participant, PmesRecord } from "@prisma/client";

export type MembershipStage =
  | "NO_PARTICIPANT"
  | "PMES_NOT_PASSED"
  | "AWAITING_LOI"
  | "AWAITING_PAYMENT"
  | "PENDING_BOARD"
  | "AWAITING_FULL_PROFILE"
  | "FULL_MEMBER";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function digitsOnly(s: string | undefined): string {
  return String(s ?? "").replace(/\D/g, "");
}

/** Non-digits removed; if more than 9 digits, drop last 3 repeatedly (sheet TINs often end in 000). */
function normalizeTinDigits(raw: string | undefined): string {
  let d = digitsOnly(raw);
  while (d.length > 9) {
    d = d.slice(0, -3);
  }
  return d;
}

function composeLegacyFullName(row: ImportLegacyPioneerRowDto): string | null {
  const direct = row.fullName?.trim();
  if (direct) return direct;
  const f = row.firstName?.trim() ?? "";
  const m = row.middleName?.trim() ?? "";
  const l = row.lastName?.trim() ?? "";
  if (!f && !l) return null;
  return [f, m, l].filter(Boolean).join(" ").trim() || null;
}

/** Lowercase + collapse spaces — compare roster fullName to reclaim form. */
function normalizeFullNameForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveLegacyGender(row: ImportLegacyPioneerRowDto): string | null {
  const g = row.gender?.trim() || row.sexGender?.trim();
  if (g) return g;
  const sh = row.sheet;
  if (sh && typeof sh === "object") {
    const raw = (sh as Record<string, unknown>)["Sex/Gender"] ?? (sh as Record<string, unknown>).sexGender;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

function synthesizeLegacyImportEmail(row: ImportLegacyPioneerRowDto): string {
  const fromRow = row.email?.trim();
  if (fromRow) return normalizeEmail(fromRow);
  const tin = normalizeTinDigits(row.tinNo);
  if (tin.length >= 6) return normalizeEmail(`tin-${tin}@b2c-registry.example.com`);
  return normalizeEmail(`legacy-${randomUUID()}@b2c-registry.example.com`);
}

function buildLegacyMailingAddress(row: ImportLegacyPioneerRowDto): string | null {
  const parts = [
    row.street?.trim(),
    row.barangay?.trim(),
    row.cityMunicipality?.trim(),
    row.province?.trim(),
  ].filter(Boolean);
  if (parts.length === 0) {
    const sh = row.sheet;
    if (sh && typeof sh === "object") {
      const o = sh as Record<string, unknown>;
      const p = [o.Street, o.Barangay, o["City/ Municipality"], o.Province]
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean);
      if (p.length) return p.join(", ");
    }
    return null;
  }
  return parts.join(", ");
}

function buildRegistryImportSnapshot(
  row: ImportLegacyPioneerRowDto,
  meta: { resolvedEmail: string; dobPlaceholder: boolean },
): Prisma.InputJsonValue {
  const flat: Record<string, unknown> = {
    email: row.email ?? null,
    fullName: row.fullName ?? null,
    lastName: row.lastName ?? null,
    firstName: row.firstName ?? null,
    middleName: row.middleName ?? null,
    phone: row.phone ?? null,
    dob: row.dob ?? null,
    gender: row.gender ?? null,
    sexGender: row.sexGender ?? null,
    registryTimestamp: row.registryTimestamp ?? null,
    civilStatus: row.civilStatus ?? null,
    street: row.street ?? null,
    barangay: row.barangay ?? null,
    cityMunicipality: row.cityMunicipality ?? null,
    province: row.province ?? null,
    tinNo: normalizeTinDigits(row.tinNo) || null,
    tinNoAsImported: row.tinNo?.trim() || null,
    initialSubscriptionAmount: row.initialSubscriptionAmount ?? null,
    paidUpShareAmount: row.paidUpShareAmount ?? null,
    religion: row.religion ?? null,
    resolvedEmail: meta.resolvedEmail,
    dobPlaceholder: meta.dobPlaceholder,
    importedAt: new Date().toISOString(),
  };
  const sheet = row.sheet && typeof row.sheet === "object" ? { ...(row.sheet as object) } : {};
  const merged = { ...sheet, ...flat };
  for (const k of Object.keys(merged)) {
    const v = merged[k as keyof typeof merged];
    if (v === undefined || v === null || v === "") {
      delete merged[k as keyof typeof merged];
    }
  }
  return merged as Prisma.InputJsonValue;
}

type ParticipantWithRelations = Participant & {
  pmesRecords: PmesRecord[];
  loiSubmission: LoiSubmission | null;
};

export type MemberRegistryRow = {
  participantId: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  mailingAddress: string | null;
  civilStatus: string | null;
  memberIdNo: string | null;
  loiAddress: string | null;
  fullProfileCompletedAt: string | null;
};

@Injectable()
export class PmesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upsert participant by email, append PMES attempt; returns flat shape for the existing UI. */
  async submitSession(dto: CreatePmesDto) {
    const email = normalizeEmail(dto.email);
    const { participant, record } = await this.prisma.$transaction(async (tx) => {
      const participantRow = await tx.participant.upsert({
        where: { email },
        create: {
          fullName: dto.fullName.trim(),
          email,
          phone: dto.phone.trim(),
          dob: dto.dob.trim(),
          gender: dto.gender.trim(),
        },
        update: {
          fullName: dto.fullName.trim(),
          phone: dto.phone.trim(),
          dob: dto.dob.trim(),
          gender: dto.gender.trim(),
        },
      });
      const recordRow = await tx.pmesRecord.create({
        data: {
          participantId: participantRow.id,
          score: dto.score,
          passed: dto.passed,
        },
      });
      return { participant: participantRow, record: recordRow };
    });

    return this.flattenRecord(participant, record);
  }

  async submitLoi(dto: CreateLoiDto) {
    const email = normalizeEmail(dto.email);
    const participant = await this.prisma.participant.findUnique({ where: { email } });
    if (!participant) {
      throw new NotFoundException("Participant not found for this email");
    }
    await this.prisma.loiSubmission.upsert({
      where: { participantId: participant.id },
      create: {
        participantId: participant.id,
        address: dto.address.trim(),
        occupation: dto.occupation.trim(),
        employer: dto.employer.trim(),
        initialCapital: dto.initialCapital,
      },
      update: {
        address: dto.address.trim(),
        occupation: dto.occupation.trim(),
        employer: dto.employer.trim(),
        initialCapital: dto.initialCapital,
      },
    });
    return { success: true };
  }

  async findCertificateRecord(emailRaw: string, dob: string) {
    const email = normalizeEmail(emailRaw);
    const participant = await this.prisma.participant.findUnique({
      where: { email },
      include: { pmesRecords: { orderBy: { timestamp: "desc" } } },
    });
    if (!participant || participant.pmesRecords.length === 0) {
      return null;
    }
    const passed = participant.pmesRecords.find((r) => r.passed);
    const record = passed ?? participant.pmesRecords[0];
    return this.flattenRecord(participant, record);
  }

  /**
   * Master list is driven by `PmesRecord` rows. Legacy founder imports normally create a passing
   * attempt, but older or hand-edited data can leave `legacyPioneerImport` participants with no
   * PMES row — they would be invisible here. Backfill one passing record so they appear like imports.
   */
  private async ensurePmesRowsForLegacyFoundersWithoutAttempt() {
    const orphans = await this.prisma.participant.findMany({
      where: {
        legacyPioneerImport: true,
        pmesRecords: { none: {} },
      },
      select: { id: true },
    });
    if (orphans.length === 0) return;
    await this.prisma.$transaction(
      orphans.map((p) =>
        this.prisma.pmesRecord.create({
          data: {
            participantId: p.id,
            score: 10,
            passed: true,
          },
        }),
      ),
    );
  }

  async listAllPmesForAdmin() {
    await this.ensurePmesRowsForLegacyFoundersWithoutAttempt();
    const rows = await this.prisma.pmesRecord.findMany({
      include: { participant: true },
      orderBy: { timestamp: "desc" },
    });
    return rows.map(({ id, score, passed, participant, timestamp }) => ({
      id,
      score,
      passed,
      fullName: participant.fullName,
      email: participant.email,
      phone: participant.phone,
      dob: participant.dob,
      gender: participant.gender,
      legacyPioneerImport: participant.legacyPioneerImport,
      timestamp: timestamp.toISOString(),
    }));
  }

  /** Superuser-only: remove one PMES attempt row (does not delete the participant). */
  async deletePmesRecordById(recordId: string) {
    const id = String(recordId ?? "").trim();
    if (!id) {
      throw new BadRequestException("record id is required");
    }
    try {
      await this.prisma.pmesRecord.delete({ where: { id } });
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "P2025") {
        throw new NotFoundException("PMES record not found");
      }
      throw e;
    }
    return { deleted: true, id };
  }

  /**
   * Superuser only: permanently remove a participant and all related PMES attempts and LOI.
   * Use to drop duplicate/stale pipeline rows (e.g. second email) without touching other participants.
   */
  async deleteParticipantById(participantId: string) {
    const id = String(participantId ?? "").trim();
    if (!id) {
      throw new BadRequestException("participant id is required");
    }

    const exists = await this.prisma.participant.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException("Participant not found");
    }

    await this.prisma.$transaction([
      this.prisma.pmesRecord.deleteMany({ where: { participantId: id } }),
      this.prisma.loiSubmission.deleteMany({ where: { participantId: id } }),
      this.prisma.participant.delete({ where: { id } }),
    ]);

    return { deleted: true, participantId: id };
  }

  /** Member-facing: derive cooperative membership pipeline from DB */
  async getMembershipLifecycle(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    const participant = await this.prisma.participant.findUnique({
      where: { email },
      include: {
        pmesRecords: { orderBy: { timestamp: "desc" } },
        loiSubmission: true,
      },
    });
    if (!participant) {
      return {
        participantId: null as string | null,
        email,
        stage: "NO_PARTICIPANT" as const,
        pmEsPassed: false,
        loiSubmitted: false,
        initialFeesPaid: false,
        boardApproved: false,
        fullProfileCompleted: false,
        canAccessFullMemberPortal: false,
        memberIdNo: null as string | null,
        callsign: null as string | null,
        alternatePublicHandle: null as string | null,
      };
    }
    const withMemberId = await this.ensureMemberPublicId(participant);
    return this.toLifecyclePayload(withMemberId);
  }

  async updateParticipantMembership(dto: UpdateParticipantMembershipDto) {
    const p = await this.prisma.participant.findUnique({ where: { id: dto.participantId } });
    if (!p) throw new NotFoundException("Participant not found");

    if (dto.initialFeesPaid !== true && dto.boardApproved !== true) {
      throw new BadRequestException("Set initialFeesPaid and/or boardApproved to true to record a step.");
    }

    const data: {
      initialFeesPaidAt?: Date | null;
      boardApprovedAt?: Date | null;
    } = {};

    if (dto.initialFeesPaid === true) {
      data.initialFeesPaidAt = new Date();
    }
    if (dto.boardApproved === true) {
      data.boardApprovedAt = new Date();
    }

    const updated = await this.prisma.participant.update({
      where: { id: dto.participantId },
      data,
      include: {
        pmesRecords: { orderBy: { timestamp: "desc" } },
        loiSubmission: true,
      },
    });
    return this.toLifecyclePayload(updated);
  }

  async submitFullProfile(dto: SubmitFullProfileDto) {
    const email = normalizeEmail(dto.email);
    const participant = await this.prisma.participant.findUnique({
      where: { email },
      include: {
        pmesRecords: { orderBy: { timestamp: "desc" } },
        loiSubmission: true,
      },
    });
    if (!participant) throw new NotFoundException("Participant not found");
    if (!participant.boardApprovedAt) {
      throw new BadRequestException("Board approval is required before submitting the full member profile.");
    }
    if (participant.fullProfileCompletedAt) {
      throw new BadRequestException("Full profile was already submitted.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(dto.profileJson) as unknown;
    } catch {
      throw new BadRequestException("profileJson must be valid JSON.");
    }

    const withMemberId = await this.ensureMemberPublicId(participant, parsed);
    const root = asObject(parsed);
    if (root && withMemberId.memberIdNo?.trim()) {
      const personal = asObject(root.personal) ?? {};
      personal.memberIdNo = withMemberId.memberIdNo.trim();
      root.personal = personal;
      parsed = root;
    }

    const rootForCallsign = asObject(parsed);
    let callsignOut: string | null = null;
    const personalForCallsign = rootForCallsign ? asObject(rootForCallsign.personal) : null;
    const lastNameRaw =
      personalForCallsign && typeof personalForCallsign.lastName === "string"
        ? personalForCallsign.lastName
        : "";
    const slug = normalizeLastNameKey(lastNameRaw);
    const rawCall =
      personalForCallsign && typeof personalForCallsign.callsign === "string"
        ? personalForCallsign.callsign.trim()
        : "";
    if (rawCall) {
      callsignOut = validateAndNormalizeCallsignInput(rawCall);
      await this.assertCallsignAvailable(callsignOut, withMemberId.id);
    }
    if (rootForCallsign && personalForCallsign) {
      if (callsignOut) {
        personalForCallsign.callsign = callsignOut;
      } else {
        delete personalForCallsign.callsign;
      }
      rootForCallsign.personal = personalForCallsign;
      parsed = rootForCallsign;
    }

    const payload = {
      formVersion: "b2c-membership-v1",
      profile: parsed,
      sheetFileName: dto.sheetFileName ?? "",
      notes: dto.notes ?? "",
      submittedAt: new Date().toISOString(),
    };

    const derived = deriveFromMemberProfile(parsed);

    await this.prisma.$transaction(async (tx) => {
      let lastNameKey = participant.lastNameKey;
      let lastNameSeq = participant.lastNameSeq;
      if (slug && lastNameSeq == null) {
        const row = await tx.lastNameCounter.upsert({
          where: { lastNameKey: slug },
          create: { lastNameKey: slug, nextSeq: 1 },
          update: { nextSeq: { increment: 1 } },
        });
        lastNameKey = slug;
        lastNameSeq = row.nextSeq;
      }

      await tx.participant.update({
        where: { id: withMemberId.id },
        data: {
          fullProfileCompletedAt: new Date(),
          fullProfileJson: JSON.stringify(payload),
          memberProfileSnapshot: parsed as Prisma.InputJsonValue,
          mailingAddress: derived.mailingAddress.trim() || null,
          civilStatus: derived.civilStatus.trim() || null,
          memberIdNo: withMemberId.memberIdNo?.trim() || derived.memberIdNo.trim() || null,
          callsign: callsignOut,
          lastNameKey,
          lastNameSeq,
        },
      });
    });

    return { success: true };
  }

  /**
   * Public (throttled): full name + TIN match a legacy-imported pioneer row that still needs the digital membership profile.
   * Returns `signInEmail` (synthesized or from import) for Firebase — roster sheets often had no member email column.
   */
  async checkPioneerEligibility(dto: PioneerEligibilityDto) {
    const rowLike: ImportLegacyPioneerRowDto = {
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
    };
    const fullNameInput = composeLegacyFullName(rowLike);
    if (!fullNameInput || fullNameInput.length < 2) {
      throw new BadRequestException("firstName and lastName are required.");
    }
    const normalizedName = normalizeFullNameForMatch(fullNameInput);
    const tinDigits = normalizeTinDigits(dto.tinNo);
    if (!tinDigits.length) {
      throw new BadRequestException(
        "TIN is required after normalizing digits (use 000000000 if your roster row had no TIN).",
      );
    }

    const zeroTin = "000000000";
    const tinWhere: Prisma.ParticipantWhereInput =
      tinDigits === zeroTin
        ? { OR: [{ memberIdNo: zeroTin }, { memberIdNo: null }] }
        : { memberIdNo: tinDigits };

    const candidates = await this.prisma.participant.findMany({
      where: {
        legacyPioneerImport: true,
        fullProfileCompletedAt: null,
        ...tinWhere,
      },
      select: { email: true, fullName: true },
    });

    const matched = candidates.filter((c) => normalizeFullNameForMatch(c.fullName) === normalizedName);

    if (matched.length === 0) {
      return { eligible: false as const, reason: "not_found" as const };
    }
    if (matched.length > 1) {
      return { eligible: false as const, reason: "ambiguous" as const };
    }
    return { eligible: true as const, signInEmail: normalizeEmail(matched[0].email) };
  }

  /**
   * Admin: bulk-create participants positioned at AWAITING_FULL_PROFILE (PMES passed, LOI/fees/board satisfied).
   * Accepts full B2C registry columns (names split, address, TIN, amounts, religion, `sheet` passthrough) plus
   * optional email/phone/dob — missing email is synthesized from TIN or a stable placeholder; missing dob uses
   * a placeholder until staff updates the row for reclaim.
   */
  async importLegacyPioneers(rows: ImportLegacyPioneerRowDto[]) {
    const created: string[] = [];
    const skipped: { email: string; reason: string }[] = [];
    for (const row of rows) {
      const fullName = composeLegacyFullName(row);
      if (!fullName || fullName.length < 2) {
        skipped.push({ email: row.email ?? "(no email)", reason: "fullName_or_name_parts_required" });
        continue;
      }

      const genderRaw = resolveLegacyGender(row);
      const gender = (genderRaw && genderRaw.length > 0 ? genderRaw : "Unknown").slice(0, 80);

      const email = synthesizeLegacyImportEmail(row);
      const existing = await this.prisma.participant.findUnique({ where: { email } });
      if (existing) {
        skipped.push({
          email,
          reason: existing.legacyPioneerImport ? "already_imported" : "email_already_registered",
        });
        continue;
      }

      const dobRaw = row.dob?.trim();
      const dobPlaceholder = !dobRaw || dobRaw.length < 4;
      const dob = dobPlaceholder ? "1900-01-01" : dobRaw.slice(0, 64);

      const phone = row.phone?.trim() && row.phone.trim().length >= 5 ? row.phone.trim().slice(0, 80) : "+639000000000";

      const mailing = buildLegacyMailingAddress(row);
      const tinDigitsRaw = normalizeTinDigits(row.tinNo);
      /** Missing TIN on sheet: store nine zeroes so reclaim can match name + 000000000 (email may still be UUID if no TIN for synthesis). */
      const memberId = (tinDigitsRaw.length > 0 ? tinDigitsRaw : "000000000").slice(0, 80);
      const civil = row.civilStatus?.trim().slice(0, 80) ?? null;

      const snapshot = buildRegistryImportSnapshot(row, { resolvedEmail: email, dobPlaceholder });

      const loiAddress =
        mailing?.trim() ||
        "(Imported — confirm or update in your membership form)";

      try {
        await this.prisma.participant.create({
          data: {
            email,
            fullName: fullName.slice(0, 500),
            phone,
            dob,
            gender,
            civilStatus: civil,
            memberIdNo: memberId,
            mailingAddress: mailing,
            legacyPioneerImport: true,
            registryImportSnapshot: snapshot,
            initialFeesPaidAt: new Date(),
            boardApprovedAt: new Date(),
            pmesRecords: {
              create: {
                score: 10,
                passed: true,
              },
            },
            loiSubmission: {
              create: {
                address: loiAddress.slice(0, 2000),
                occupation: "Legacy pioneer",
                employer: "—",
                initialCapital: 0,
              },
            },
          },
        });
        created.push(email);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "create_failed";
        skipped.push({ email, reason: msg });
      }
    }
    return { created, skipped, totalInput: rows.length };
  }

  /**
   * Admin: searchable member registry (default: participants who completed the full membership form).
   * Denormalized columns are filled on submit; older rows fall back to parsing `fullProfileJson`.
   */
  async listMemberRegistry(params: { q?: string; page?: number; pageSize?: number; includeAll?: boolean }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
    const q = params.q?.trim();
    const includeAll = params.includeAll === true;

    const searchFilter: Prisma.ParticipantWhereInput | undefined = q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { mailingAddress: { contains: q, mode: "insensitive" } },
            { memberIdNo: { contains: q, mode: "insensitive" } },
            { civilStatus: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined;

    const where: Prisma.ParticipantWhereInput = {
      ...(includeAll ? {} : { fullProfileCompletedAt: { not: null } }),
      ...(searchFilter ? searchFilter : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.participant.count({ where }),
      this.prisma.participant.findMany({
        where,
        include: { loiSubmission: true },
        orderBy: [{ fullProfileCompletedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      rows: rows.map((p) => this.buildRegistryRow(p)),
      total,
      page,
      pageSize,
    };
  }

  /** Admin: full participant detail for registry / audit (includes JSON profile snapshot). */
  async getParticipantAdminDetail(participantId: string) {
    const p = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        loiSubmission: true,
        pmesRecords: { orderBy: { timestamp: "desc" }, take: 12 },
      },
    });
    if (!p) throw new NotFoundException("Participant not found");

    const envelope = parseFullProfileEnvelope(p.fullProfileJson);
    const snapshot = p.memberProfileSnapshot ?? envelope?.profile ?? null;

    return {
      registry: this.buildRegistryRow(p),
      lifecycle: this.toLifecyclePayload(p),
      registryImportSnapshot: p.registryImportSnapshot ?? null,
      loiSubmission: p.loiSubmission,
      memberProfileSnapshot: snapshot,
      fullProfileMeta: envelope
        ? {
            formVersion: envelope.formVersion ?? null,
            sheetFileName: envelope.sheetFileName ?? null,
            notes: envelope.notes ?? null,
            submittedAt: envelope.submittedAt ?? null,
          }
        : null,
      pmesRecords: p.pmesRecords.map((r) => ({
        id: r.id,
        score: r.score,
        passed: r.passed,
        timestamp: r.timestamp.toISOString(),
      })),
    };
  }

  private resolveProfileForDerivation(p: Participant): unknown {
    if (p.memberProfileSnapshot != null) return p.memberProfileSnapshot;
    const env = parseFullProfileEnvelope(p.fullProfileJson);
    return env?.profile ?? null;
  }

  private buildRegistryRow(p: Participant & { loiSubmission: LoiSubmission | null }): MemberRegistryRow {
    const profile = this.resolveProfileForDerivation(p);
    const derived = deriveFromMemberProfile(profile);
    const mailingFromCol = p.mailingAddress?.trim();
    const mailingFromProfile = derived.mailingAddress.trim();
    const mailingFromLoi = p.loiSubmission?.address?.trim();
    const mailingAddress =
      mailingFromCol || mailingFromProfile || mailingFromLoi
        ? mailingFromCol || mailingFromProfile || mailingFromLoi || null
        : null;
    const civilRaw = p.civilStatus?.trim() || derived.civilStatus.trim();
    const idRaw = p.memberIdNo?.trim() || derived.memberIdNo.trim();
    const civilStatus = civilRaw || null;
    const memberIdNo = idRaw || null;

    return {
      participantId: p.id,
      fullName: p.fullName,
      email: p.email,
      phone: p.phone,
      dob: p.dob,
      gender: p.gender,
      mailingAddress,
      civilStatus,
      memberIdNo,
      loiAddress: p.loiSubmission?.address ?? null,
      fullProfileCompletedAt: p.fullProfileCompletedAt?.toISOString() ?? null,
    };
  }

  /** Admin dashboard: one row per participant with pipeline flags */
  async listMembershipPipeline() {
    const participants = await this.prisma.participant.findMany({
      include: {
        pmesRecords: { orderBy: { timestamp: "desc" }, take: 8 },
        loiSubmission: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return participants.map((p) => {
      const life = this.toLifecyclePayload(p);
      return {
        fullName: p.fullName,
        phone: p.phone,
        ...life,
      };
    });
  }

  private toLifecyclePayload(participant: ParticipantWithRelations) {
    const email = participant.email;
    const passed = participant.pmesRecords.some((r) => r.passed);
    const hasLoi = !!participant.loiSubmission;
    const fees = !!participant.initialFeesPaidAt;
    const board = !!participant.boardApprovedAt;
    const profile = !!participant.fullProfileCompletedAt;

    let stage: MembershipStage;
    if (!passed) stage = "PMES_NOT_PASSED";
    else if (!hasLoi) stage = "AWAITING_LOI";
    else if (!fees) stage = "AWAITING_PAYMENT";
    else if (!board) stage = "PENDING_BOARD";
    else if (!profile) stage = "AWAITING_FULL_PROFILE";
    else stage = "FULL_MEMBER";

    return {
      participantId: participant.id,
      email,
      stage,
      pmEsPassed: passed,
      loiSubmitted: hasLoi,
      initialFeesPaid: fees,
      boardApproved: board,
      fullProfileCompleted: profile,
      canAccessFullMemberPortal: stage === "FULL_MEMBER",
      /** Pre-roster import: member already pledged elsewhere; digital PMES not required on this app. */
      isLegacyFounderImport: participant.legacyPioneerImport,
      /** Assigned once by the server; format B2C-{initials}-{YY}-{suffix} (memorable + unguessable tail). */
      memberIdNo: participant.memberIdNo,
      /** Optional member-chosen handle (unique). */
      callsign: participant.callsign,
      /** Callsign if set, else `lastNameKey-lastNameSeq` when assigned (e.g. cruz-2). */
      alternatePublicHandle: computeAlternatePublicHandle({
        callsign: participant.callsign,
        lastNameKey: participant.lastNameKey,
        lastNameSeq: participant.lastNameSeq,
      }),
    };
  }

  /**
   * Map email, callsign, default alternate (`lastname-seq`), or member ID → account email for Firebase sign-in.
   * Returns null if nothing matches.
   */
  async resolveLoginEmailForFirebase(raw: string): Promise<{ email: string } | null> {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return null;

    if (trimmed.includes("@")) {
      const email = normalizeEmail(trimmed);
      const byEmail = await this.prisma.participant.findUnique({
        where: { email },
        select: { email: true },
      });
      return byEmail ? { email: byEmail.email } : null;
    }

    const byMemberId = await this.prisma.participant.findFirst({
      where: { memberIdNo: { equals: trimmed, mode: "insensitive" } },
      select: { email: true },
    });
    if (byMemberId) return { email: byMemberId.email };

    const lower = trimmed.toLowerCase();
    const byCallsign = await this.prisma.participant.findUnique({
      where: { callsign: lower },
      select: { email: true },
    });
    if (byCallsign) return { email: byCallsign.email };

    const m = lower.match(/^([a-z0-9]{2,})-(\d{1,5})$/);
    if (m) {
      const slug = m[1]!;
      const seq = parseInt(m[2]!, 10);
      if (!Number.isFinite(seq) || seq < 1) return null;
      const bySlug = await this.prisma.participant.findFirst({
        where: { lastNameKey: slug, lastNameSeq: seq },
        select: { email: true },
      });
      if (bySlug) return { email: bySlug.email };
    }

    return null;
  }

  /**
   * Optional callsign or clear it (Firebase-authenticated via controller).
   * Does not change last-name sequence; clearing falls back to default alternate.
   */
  async setMemberCallsign(dto: { email: string; callsign?: string }) {
    const email = normalizeEmail(dto.email);
    const participant = await this.prisma.participant.findUnique({ where: { email } });
    if (!participant) throw new NotFoundException("Participant not found");

    const raw =
      dto.callsign === undefined || dto.callsign === null ? "" : String(dto.callsign).trim();

    if (!raw) {
      const updated = await this.prisma.participant.update({
        where: { id: participant.id },
        data: { callsign: null },
      });
      return {
        success: true as const,
        callsign: null as string | null,
        alternatePublicHandle: computeAlternatePublicHandle({
          callsign: null,
          lastNameKey: updated.lastNameKey,
          lastNameSeq: updated.lastNameSeq,
        }),
      };
    }

    const normalized = validateAndNormalizeCallsignInput(raw);
    await this.assertCallsignAvailable(normalized, participant.id);
    const updated = await this.prisma.participant.update({
      where: { id: participant.id },
      data: { callsign: normalized },
    });
    return {
      success: true as const,
      callsign: normalized,
      alternatePublicHandle: computeAlternatePublicHandle({
        callsign: updated.callsign,
        lastNameKey: updated.lastNameKey,
        lastNameSeq: updated.lastNameSeq,
      }),
    };
  }

  private async assertCallsignAvailable(normalized: string, excludeParticipantId: string): Promise<void> {
    const other = await this.prisma.participant.findFirst({
      where: {
        id: { not: excludeParticipantId },
        OR: [
          { callsign: normalized },
          { memberIdNo: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (other) {
      throw new ConflictException("That handle is already in use. Choose a different one.");
    }
  }

  /**
   * Assigns a public member ID when missing: `B2C-{initials}-{cohortYY}-{rand4}`.
   * Preserves any non-empty existing value (legacy TIN, staff entry, prior assignment).
   */
  private async ensureMemberPublicId(
    participant: ParticipantWithRelations,
    profile?: unknown,
  ): Promise<ParticipantWithRelations> {
    if (String(participant.memberIdNo ?? "").trim()) {
      return participant;
    }

    let initials = initialsFromFullName(participant.fullName);
    let yy = cohortYYFromDob(participant.dob, participant.createdAt);

    const root = profile ? asObject(profile) : null;
    const personal = root ? asObject(root.personal) : null;
    if (personal) {
      const fn = typeof personal.firstName === "string" ? personal.firstName : "";
      const ln = typeof personal.lastName === "string" ? personal.lastName : "";
      if (fn.trim() && ln.trim()) {
        initials = initialsFromFirstLast(fn, ln, participant.fullName);
      }
      const bd = typeof personal.birthDate === "string" ? personal.birthDate : "";
      if (bd.trim()) {
        yy = cohortYYFromDob(bd, participant.createdAt);
      }
    }

    for (let attempt = 0; attempt < 16; attempt++) {
      const id = buildMemberPublicId(initials, yy);
      const clash = await this.prisma.participant.findFirst({
        where: { memberIdNo: id, id: { not: participant.id } },
        select: { id: true },
      });
      if (clash) continue;

      return await this.prisma.participant.update({
        where: { id: participant.id },
        data: { memberIdNo: id },
        include: {
          pmesRecords: { orderBy: { timestamp: "desc" } },
          loiSubmission: true,
        },
      });
    }

    throw new InternalServerErrorException("Could not allocate a unique member ID after retries.");
  }

  private flattenRecord(
    participant: { fullName: string; email: string; phone: string; dob: string; gender: string },
    record: { id: string; score: number; passed: boolean; timestamp: Date },
  ) {
    return {
      id: record.id,
      fullName: participant.fullName,
      email: participant.email,
      phone: participant.phone,
      dob: participant.dob,
      gender: participant.gender,
      score: record.score,
      passed: record.passed,
      timestamp: record.timestamp.toISOString(),
    };
  }
}

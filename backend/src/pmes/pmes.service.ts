import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLoiDto } from "./dto/create-loi.dto";
import { CreatePmesDto } from "./dto/create-pmes.dto";
import { SubmitFullProfileDto } from "./dto/submit-full-profile.dto";
import type { ImportLegacyPioneerRowDto } from "./dto/import-legacy-pioneers.dto";
import { UpdateParticipantMembershipDto } from "./dto/update-participant-membership.dto";
import { deriveFromMemberProfile, parseFullProfileEnvelope } from "./member-profile.extract";
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

  async listAllPmesForAdmin() {
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
      };
    }
    return this.toLifecyclePayload(participant);
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
    const participant = await this.prisma.participant.findUnique({ where: { email } });
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

    const payload = {
      formVersion: "b2c-membership-v1",
      profile: parsed,
      sheetFileName: dto.sheetFileName ?? "",
      notes: dto.notes ?? "",
      submittedAt: new Date().toISOString(),
    };

    const derived = deriveFromMemberProfile(parsed);

    await this.prisma.participant.update({
      where: { id: participant.id },
      data: {
        fullProfileCompletedAt: new Date(),
        fullProfileJson: JSON.stringify(payload),
        memberProfileSnapshot: parsed as Prisma.InputJsonValue,
        mailingAddress: derived.mailingAddress.trim() || null,
        civilStatus: derived.civilStatus.trim() || null,
        memberIdNo: derived.memberIdNo.trim() || null,
      },
    });
    return { success: true };
  }

  /**
   * Public (throttled): email + DOB match a legacy-imported pioneer row that still needs the digital membership profile.
   */
  async checkPioneerEligibility(emailRaw: string, dobRaw: string) {
    const email = normalizeEmail(emailRaw);
    const dob = dobRaw.trim();
    if (!email || !dob) {
      throw new BadRequestException("email and dob are required.");
    }
    const p = await this.prisma.participant.findUnique({ where: { email } });
    if (!p?.legacyPioneerImport) {
      return { eligible: false as const };
    }
    if (p.dob.trim() !== dob) {
      return { eligible: false as const };
    }
    if (p.fullProfileCompletedAt) {
      return { eligible: false as const };
    }
    return { eligible: true as const };
  }

  /**
   * Admin: bulk-create participants positioned at AWAITING_FULL_PROFILE (PMES passed, LOI/fees/board satisfied).
   */
  async importLegacyPioneers(rows: ImportLegacyPioneerRowDto[]) {
    const created: string[] = [];
    const skipped: { email: string; reason: string }[] = [];
    for (const row of rows) {
      const email = normalizeEmail(row.email);
      const existing = await this.prisma.participant.findUnique({ where: { email } });
      if (existing) {
        skipped.push({
          email,
          reason: existing.legacyPioneerImport ? "already_imported" : "email_already_registered",
        });
        continue;
      }
      try {
        await this.prisma.participant.create({
          data: {
            email,
            fullName: row.fullName.trim(),
            phone: row.phone.trim(),
            dob: row.dob.trim(),
            gender: row.gender.trim(),
            legacyPioneerImport: true,
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
                address: "(Imported — confirm or update in your membership form)",
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
    };
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

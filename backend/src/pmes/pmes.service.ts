import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLoiDto } from "./dto/create-loi.dto";
import { CreatePmesDto } from "./dto/create-pmes.dto";
import { SubmitFullProfileDto } from "./dto/submit-full-profile.dto";
import { UpdateParticipantMembershipDto } from "./dto/update-participant-membership.dto";
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

    const payload = {
      ...dto.fields,
      sheetFileName: dto.sheetFileName ?? "",
      notes: dto.notes ?? "",
      submittedAt: new Date().toISOString(),
    };

    await this.prisma.participant.update({
      where: { id: participant.id },
      data: {
        fullProfileCompletedAt: new Date(),
        fullProfileJson: JSON.stringify(payload),
      },
    });
    return { success: true };
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

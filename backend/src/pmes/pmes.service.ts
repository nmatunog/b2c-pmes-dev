import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLoiDto } from "./dto/create-loi.dto";
import { CreatePmesDto } from "./dto/create-pmes.dto";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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

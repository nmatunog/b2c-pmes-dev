import { BadRequestException, Controller, Get, NotFoundException, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StoreIntegrationGuard } from "./store-integration.guard";

@Controller("integrations/v1/members")
export class StoreIntegrationsController {
  constructor(private readonly prisma: PrismaService) {}

  /** B2C-Store checkout — resolve guest email to Participant.id */
  @Get("resolve")
  @UseGuards(StoreIntegrationGuard)
  async resolveByEmail(@Query("email") emailRaw?: string) {
    const email = String(emailRaw ?? "").trim().toLowerCase();
    if (!email) {
      throw new BadRequestException("email query parameter is required");
    }

    const participant = await this.prisma.participant.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        memberIdNo: true,
        fullName: true,
      },
    });

    if (!participant) {
      throw new NotFoundException("Member not found");
    }

    return {
      participantId: participant.id,
      memberIdNo: participant.memberIdNo,
      email: participant.email,
      fullName: participant.fullName,
    };
  }
}

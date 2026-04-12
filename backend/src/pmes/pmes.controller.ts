import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CertificateQueryDto } from "./dto/certificate-query.dto";
import { CreateLoiDto } from "./dto/create-loi.dto";
import { CreatePmesDto } from "./dto/create-pmes.dto";
import { ImportLegacyPioneersDto } from "./dto/import-legacy-pioneers.dto";
import { PioneerEligibilityDto } from "./dto/pioneer-eligibility.dto";
import { SubmitFullProfileDto } from "./dto/submit-full-profile.dto";
import { UpdateParticipantMembershipDto } from "./dto/update-participant-membership.dto";
import { StaffJwtGuard } from "../auth/staff-jwt.guard";
import { SuperuserGuard } from "../auth/superuser.guard";
import { PmesService } from "./pmes.service";

@Controller("pmes")
export class PmesController {
  constructor(private readonly pmes: PmesService) {}

  @Post("submit")
  submit(@Body() dto: CreatePmesDto) {
    return this.pmes.submitSession(dto);
  }

  @Post("loi")
  submitLoi(@Body() dto: CreateLoiDto) {
    return this.pmes.submitLoi(dto);
  }

  @Get("certificate")
  async certificate(@Query() query: CertificateQueryDto) {
    const record = await this.pmes.findCertificateRecord(query.email, query.dob.trim());
    if (!record) {
      throw new NotFoundException("Record not found");
    }
    return record;
  }

  /** Member pipeline: LOI → fees → board → full profile (query by signed-in user email from client) */
  @Get("membership-lifecycle")
  membershipLifecycle(@Query("email") email: string) {
    if (!email?.trim()) {
      throw new BadRequestException("email query parameter is required");
    }
    return this.pmes.getMembershipLifecycle(email);
  }

  @Post("full-profile")
  submitFullProfile(@Body() dto: SubmitFullProfileDto) {
    return this.pmes.submitFullProfile(dto);
  }

  /** Public: verify pioneer roster match before Firebase sign-up (same email required). */
  @Post("pioneer/check-eligibility")
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  checkPioneerEligibility(@Body() dto: PioneerEligibilityDto) {
    return this.pmes.checkPioneerEligibility(dto.email, dto.dob);
  }

  @Post("admin/import-legacy-pioneers")
  @UseGuards(StaffJwtGuard)
  importLegacyPioneers(@Body() dto: ImportLegacyPioneersDto) {
    return this.pmes.importLegacyPioneers(dto.rows);
  }

  @Get("admin/records")
  @UseGuards(StaffJwtGuard)
  adminRecords() {
    return this.pmes.listAllPmesForAdmin();
  }

  /** Superuser only: delete one PMES attempt (master list row). */
  @Delete("admin/records/:id")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(StaffJwtGuard, SuperuserGuard)
  adminDeletePmesRecord(@Param("id") id: string) {
    return this.pmes.deletePmesRecordById(id);
  }

  @Get("admin/membership-pipeline")
  @UseGuards(StaffJwtGuard)
  adminMembershipPipeline() {
    return this.pmes.listMembershipPipeline();
  }

  @Patch("admin/participant/membership")
  @UseGuards(StaffJwtGuard)
  adminParticipantMembership(@Body() dto: UpdateParticipantMembershipDto) {
    return this.pmes.updateParticipantMembership(dto);
  }

  /** Admin: searchable member registry (full members by default). */
  @Get("admin/member-registry")
  @UseGuards(StaffJwtGuard)
  adminMemberRegistry(
    @Query("q") q?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
    @Query("includeAll") includeAllRaw?: string,
  ) {
    const page = pageRaw ? parseInt(pageRaw, 10) : undefined;
    const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : undefined;
    const includeAll = includeAllRaw === "1" || includeAllRaw === "true";
    return this.pmes.listMemberRegistry({
      q,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      includeAll,
    });
  }

  @Get("admin/participants/:id")
  @UseGuards(StaffJwtGuard)
  adminParticipantDetail(@Param("id") id: string) {
    return this.pmes.getParticipantAdminDetail(id);
  }
}

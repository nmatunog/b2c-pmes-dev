import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { SetCallsignDto } from "./dto/set-callsign.dto";
import { SubmitFullProfileDto } from "./dto/submit-full-profile.dto";
import { UpdateParticipantMembershipDto } from "./dto/update-participant-membership.dto";
import { AuthService } from "../auth/auth.service";
import { StaffJwtGuard } from "../auth/staff-jwt.guard";
import { SuperuserGuard } from "../auth/superuser.guard";
import { PmesService } from "./pmes.service";

@Controller("pmes")
export class PmesController {
  constructor(
    private readonly pmes: PmesService,
    private readonly auth: AuthService,
  ) {}

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

  /**
   * Resolve email for Firebase `signInWithEmailAndPassword` when the user enters callsign, `lastname-seq`, or member ID.
   * Throttled — still possible to probe existence; pair with strong Firebase password rules.
   */
  @Get("member/resolve-login-email")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async resolveLoginEmail(@Query("login") login: string) {
    if (!login?.trim()) {
      throw new BadRequestException("login query parameter is required");
    }
    const out = await this.pmes.resolveLoginEmailForFirebase(login);
    if (!out) {
      throw new NotFoundException("No account matches that login.");
    }
    return out;
  }

  @Post("full-profile")
  submitFullProfile(@Body() dto: SubmitFullProfileDto) {
    return this.pmes.submitFullProfile(dto);
  }

  /**
   * Optional callsign (alternate to default last-name handle). Requires Firebase ID token for same email.
   * Send empty `callsign` to clear and fall back to `lastname-seq`.
   */
  @Patch("member/callsign")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async setMemberCallsign(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: SetCallsignDto,
  ) {
    await this.auth.assertMemberEmailMatchesFirebaseToken(authorization, dto.email);
    return this.pmes.setMemberCallsign(dto);
  }

  /** Public: verify pioneer roster match (full name + TIN) before Firebase sign-up; response includes signInEmail. */
  @Post("pioneer/check-eligibility")
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  checkPioneerEligibility(@Body() dto: PioneerEligibilityDto) {
    return this.pmes.checkPioneerEligibility(dto);
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

  /** Superuser only: delete participant + PMES/LOI (removes one pipeline row). */
  @Delete("admin/participants/:id")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(StaffJwtGuard, SuperuserGuard)
  adminDeleteParticipant(@Param("id") id: string) {
    return this.pmes.deleteParticipantById(id);
  }
}

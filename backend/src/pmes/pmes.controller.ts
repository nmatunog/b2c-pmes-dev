import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CertificateQueryDto } from "./dto/certificate-query.dto";
import { CreateLoiDto } from "./dto/create-loi.dto";
import { CreatePmesDto } from "./dto/create-pmes.dto";
import { SubmitFullProfileDto } from "./dto/submit-full-profile.dto";
import { UpdateParticipantMembershipDto } from "./dto/update-participant-membership.dto";
import { StaffJwtGuard } from "../auth/staff-jwt.guard";
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

  @Get("admin/records")
  @UseGuards(StaffJwtGuard)
  adminRecords() {
    return this.pmes.listAllPmesForAdmin();
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
}

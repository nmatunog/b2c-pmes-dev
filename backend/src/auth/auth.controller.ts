import { Body, Controller, Get, Headers, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { AdminCredentialsDto } from "./dto/admin-credentials.dto";
import { ChangeStaffPasswordDto } from "./dto/change-staff-password.dto";
import { CreateStaffAdminDto } from "./dto/create-staff-admin.dto";
import { PromoteStaffSuperuserDto } from "./dto/promote-staff-superuser.dto";
import { SetMemberStaffPositionDto } from "./dto/set-member-staff-position.dto";
import { SyncMemberDto } from "./dto/sync-member.dto";
import { StaffJwtGuard, type StaffJwtPayload } from "./staff-jwt.guard";
import { SuperuserGuard } from "./superuser.guard";

type StaffRequest = Request & { staffUser: StaffJwtPayload };

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Firebase → Postgres: upsert `Participant` by Firebase uid / email.
   * Auth: matching `X-Member-Sync-Secret`, or `Authorization: Bearer <Firebase ID token>` when Firebase Admin env is set,
   * or open when neither secret nor Admin is configured (local dev).
   */
  @Post("sync-member")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async syncMember(
    @Headers("x-member-sync-secret") syncSecret: string | undefined,
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: SyncMemberDto,
  ) {
    await this.auth.assertMemberSyncAuthorized(syncSecret, authorization, dto);
    return this.auth.syncMember(dto.uid, dto.email, dto.fullName, dto.referralCode);
  }

  /** Staff sign-in (superuser or admin) — returns JWT for PMES admin routes. */
  @Post("admin/login")
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  adminLogin(@Body() dto: AdminCredentialsDto) {
    return this.auth.staffLogin(dto.email, dto.password);
  }

  /** Logged-in staff (admin/superuser): change own password. */
  @Patch("staff/password")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(StaffJwtGuard)
  changeOwnStaffPassword(@Req() req: StaffRequest, @Body() dto: ChangeStaffPasswordDto) {
    return this.auth.changeOwnStaffPassword(req.staffUser.sub, dto.currentPassword, dto.newPassword);
  }

  /** Superuser only: create an admin account (cannot create other superusers). */
  @Post("staff/admins")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(StaffJwtGuard, SuperuserGuard)
  createStaffAdmin(@Req() req: StaffRequest, @Body() dto: CreateStaffAdminDto) {
    return this.auth.createAdmin(req.staffUser.sub, dto.email, dto.password, dto.role);
  }

  /** Superuser only: promote an existing admin account to superuser. */
  @Post("staff/superusers/promote")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(StaffJwtGuard, SuperuserGuard)
  promoteStaffSuperuser(@Req() req: StaffRequest, @Body() dto: PromoteStaffSuperuserDto) {
    return this.auth.promoteAdminToSuperuser(req.staffUser.sub, dto.email);
  }

  /** Superuser only: list admin accounts (no passwords). */
  @Get("staff/admins")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(StaffJwtGuard, SuperuserGuard)
  listStaffAdmins(@Req() req: StaffRequest) {
    return this.auth.listManagedAdmins(req.staffUser.sub);
  }

  /** Superuser only: set staff role for the login whose email matches a member (Treasurer, Secretary, BOD, Admin). */
  @Patch("staff/member-position")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(StaffJwtGuard, SuperuserGuard)
  setMemberStaffPosition(@Req() req: StaffRequest, @Body() dto: SetMemberStaffPositionDto) {
    return this.auth.setStaffRoleByMemberEmail(req.staffUser.sub, dto.memberEmail, dto.role);
  }
}

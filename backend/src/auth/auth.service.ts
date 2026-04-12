import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { StaffRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as admin from "firebase-admin";
import { PrismaService } from "../prisma/prisma.service";
import type { SyncMemberDto } from "./dto/sync-member.dto";

export type StaffLoginResponse = {
  accessToken: string;
  expiresIn: string;
  role: "admin" | "superuser";
};

@Injectable()
export class AuthService {
  private firebaseAdminApp: admin.app.App | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** True when all service-account fields are present (does not initialize Firebase). */
  private isFirebaseAdminConfigured(): boolean {
    const projectId = String(this.config.get<string>("FIREBASE_PROJECT_ID") ?? "").trim();
    const clientEmail = String(this.config.get<string>("FIREBASE_CLIENT_EMAIL") ?? "").trim();
    const privateKey = String(this.config.get<string>("FIREBASE_PRIVATE_KEY") ?? "").trim();
    return Boolean(projectId && clientEmail && privateKey);
  }

  private getFirebaseAdminApp(): admin.app.App | null {
    if (this.firebaseAdminApp) return this.firebaseAdminApp;
    const projectId = String(this.config.get<string>("FIREBASE_PROJECT_ID") ?? "").trim();
    const clientEmail = String(this.config.get<string>("FIREBASE_CLIENT_EMAIL") ?? "").trim();
    let privateKey = String(this.config.get<string>("FIREBASE_PRIVATE_KEY") ?? "").trim();
    if (!projectId || !clientEmail || !privateKey) return null;
    privateKey = privateKey.replace(/\\n/g, "\n");
    if (admin.apps.length > 0) {
      this.firebaseAdminApp = admin.apps[0] as admin.app.App;
      return this.firebaseAdminApp;
    }
    this.firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return this.firebaseAdminApp;
  }

  /**
   * Updates Firebase Auth primary email only (Postgres updated by caller in the same request).
   * Use for legacy pioneer / placeholder sign-in emails → real address from the membership form.
   */
  async updateFirebasePrimaryEmail(uid: string, newEmailRaw: string): Promise<string> {
    const newEmail = newEmailRaw.trim().toLowerCase();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      throw new BadRequestException("Enter a valid email address on the membership form.");
    }
    const app = this.getFirebaseAdminApp();
    if (!app) {
      throw new BadRequestException(
        "Cannot update sign-in email: add Firebase service account env on the API (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) — same project as the web app.",
      );
    }
    let existing;
    try {
      existing = await admin.auth(app).getUserByEmail(newEmail);
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "auth/user-not-found") {
        existing = null;
      } else {
        throw e;
      }
    }
    if (existing && existing.uid !== uid) {
      throw new ConflictException("That email is already used by another Firebase account.");
    }
    const row = await this.prisma.participant.findUnique({ where: { email: newEmail } });
    if (row && row.firebaseUid && row.firebaseUid !== uid) {
      throw new ConflictException("That email is already registered for another member record.");
    }
    await admin.auth(app).updateUser(uid, { email: newEmail });
    return newEmail;
  }

  private extractBearer(authorization: string | undefined): string | null {
    const v = String(authorization ?? "").trim();
    if (!v.toLowerCase().startsWith("bearer ")) return null;
    const t = v.slice(7).trim();
    return t || null;
  }

  /**
   * Allows sync when:
   * - `X-Member-Sync-Secret` matches `MEMBER_SYNC_SECRET` (server-to-server), or
   * - `Authorization: Bearer <Firebase ID token>` verifies and matches body `uid` / `email`, or
   * - neither secret nor Firebase Admin is configured (local dev only).
   */
  async assertMemberSyncAuthorized(
    syncSecret: string | undefined,
    authorization: string | undefined,
    dto: SyncMemberDto,
  ): Promise<void> {
    const expected = String(this.config.get<string>("MEMBER_SYNC_SECRET") ?? "").trim();
    const hasSecret = Boolean(expected);
    const hasAdmin = this.isFirebaseAdminConfigured();

    if (hasSecret && String(syncSecret ?? "").trim() === expected) {
      return;
    }

    /**
     * Local dev: no `MEMBER_SYNC_SECRET` and no service account — trust `uid` / `email` in the body.
     * The browser still sends `Authorization: Bearer`; we must not reject that before this check,
     * or POST /auth/sync-member always 401s and `Participant.firebaseUid` never syncs.
     */
    if (!hasSecret && !hasAdmin) {
      return;
    }

    const bearer = this.extractBearer(authorization);
    if (bearer) {
      if (!hasAdmin) {
        throw new UnauthorizedException("Firebase Admin is not configured; cannot verify ID token");
      }
      const app = this.getFirebaseAdminApp();
      if (!app) {
        throw new UnauthorizedException("Firebase Admin is not configured");
      }
      try {
        const decoded = await admin.auth(app).verifyIdToken(bearer);
        if (decoded.uid !== dto.uid) {
          throw new UnauthorizedException("ID token does not match uid");
        }
        const tokenEmail = decoded.email?.trim().toLowerCase();
        const bodyEmail = dto.email.trim().toLowerCase();
        if (tokenEmail && tokenEmail !== bodyEmail) {
          throw new UnauthorizedException("ID token email does not match body");
        }
        return;
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        throw new UnauthorizedException("Invalid Firebase ID token");
      }
    }

    throw new UnauthorizedException("Invalid or missing member sync authorization");
  }

  /**
   * Verifies Firebase ID token email matches `emailRaw` and returns the token `uid`.
   * When neither `MEMBER_SYNC_SECRET` nor Firebase Admin is configured, returns `null` (local dev only — no uid).
   */
  async verifyMemberEmailBearer(
    authorization: string | undefined,
    emailRaw: string,
  ): Promise<string | null> {
    const normalized = emailRaw.trim().toLowerCase();
    const expected = String(this.config.get<string>("MEMBER_SYNC_SECRET") ?? "").trim();
    const hasSecret = Boolean(expected);
    const hasAdmin = this.isFirebaseAdminConfigured();
    if (!hasSecret && !hasAdmin) {
      return null;
    }
    const bearer = this.extractBearer(authorization);
    if (!bearer) {
      throw new UnauthorizedException("Authorization Bearer token required");
    }
    if (!hasAdmin) {
      throw new UnauthorizedException("Firebase Admin is not configured");
    }
    const app = this.getFirebaseAdminApp();
    if (!app) {
      throw new UnauthorizedException("Firebase Admin is not configured");
    }
    try {
      const decoded = await admin.auth(app).verifyIdToken(bearer);
      const tokenEmail = decoded.email?.trim().toLowerCase();
      if (!tokenEmail || tokenEmail !== normalized) {
        throw new UnauthorizedException("ID token email does not match member email");
      }
      return decoded.uid;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException("Invalid Firebase ID token");
    }
  }

  /**
   * Member-only routes (e.g. optional callsign): Firebase ID token email must match `email`.
   * When neither `MEMBER_SYNC_SECRET` nor Firebase Admin is configured, skips verification (local dev only).
   */
  async assertMemberEmailMatchesFirebaseToken(
    authorization: string | undefined,
    emailRaw: string,
  ): Promise<void> {
    await this.verifyMemberEmailBearer(authorization, emailRaw);
  }

  async staffLogin(email: string, password: string): Promise<StaffLoginResponse> {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const staff = await this.prisma.staffUser.findUnique({ where: { email: normalized } });
    if (!staff) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const ok = await bcrypt.compare(password ?? "", staff.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const roleJwt: "admin" | "superuser" =
      staff.role === StaffRole.SUPERUSER ? "superuser" : "admin";
    const accessToken = this.jwt.sign({ role: roleJwt, sub: staff.id });
    return { accessToken, expiresIn: "8h", role: roleJwt };
  }

  /** @deprecated alias */
  adminLogin(email: string, password: string): Promise<StaffLoginResponse> {
    return this.staffLogin(email, password);
  }

  async createAdmin(createdByStaffId: string, email: string, password: string) {
    const creator = await this.prisma.staffUser.findUnique({ where: { id: createdByStaffId } });
    if (!creator || creator.role !== StaffRole.SUPERUSER) {
      throw new ForbiddenException("Only a superuser can create admins");
    }
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.staffUser.findUnique({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException("A staff account with this email already exists");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.staffUser.create({
      data: {
        email: normalized,
        passwordHash,
        role: StaffRole.ADMIN,
        createdById: createdByStaffId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  /**
   * Bridge Firebase Auth → `Participant` (Neon/Postgres). Call after sign-up or first sign-in.
   * Upserts by `firebaseUid`, or links uid to an existing row matched by email (e.g. PMES created first).
   */
  async syncMember(uid: string, email: string, fullName?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const name = (fullName?.trim() || normalizedEmail.split("@")[0] || "Member").slice(0, 500);

    const existingByUid = await this.prisma.participant.findUnique({ where: { firebaseUid: uid } });
    if (existingByUid) {
      const updated = await this.prisma.participant.update({
        where: { id: existingByUid.id },
        data: {
          fullName: name,
          email: normalizedEmail,
        },
        select: {
          id: true,
          firebaseUid: true,
          email: true,
          fullName: true,
          createdAt: true,
        },
      });
      return {
        success: true,
        message: "Member successfully synced to PostgreSQL",
        data: updated,
      };
    }

    const existingByEmail = await this.prisma.participant.findUnique({ where: { email: normalizedEmail } });
    if (existingByEmail) {
      if (existingByEmail.firebaseUid && existingByEmail.firebaseUid !== uid) {
        throw new ConflictException("This email is already linked to another Firebase account.");
      }
      const updated = await this.prisma.participant.update({
        where: { id: existingByEmail.id },
        data: {
          firebaseUid: uid,
          fullName: existingByEmail.fullName?.trim() ? existingByEmail.fullName : name,
        },
        select: {
          id: true,
          firebaseUid: true,
          email: true,
          fullName: true,
          createdAt: true,
        },
      });
      return {
        success: true,
        message: "Firebase uid linked to existing participant",
        data: updated,
      };
    }

    const created = await this.prisma.participant.create({
      data: {
        firebaseUid: uid,
        email: normalizedEmail,
        fullName: name,
        phone: "pending",
        dob: "pending",
        gender: "unknown",
      },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });
    return {
      success: true,
      message: "Member successfully synced to PostgreSQL",
      data: created,
    };
  }

  async listManagedAdmins(actingStaffId: string) {
    const actor = await this.prisma.staffUser.findUnique({ where: { id: actingStaffId } });
    if (!actor || actor.role !== StaffRole.SUPERUSER) {
      throw new ForbiddenException("Only a superuser can list admin accounts");
    }
    return this.prisma.staffUser.findMany({
      where: { role: StaffRole.ADMIN },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        createdById: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

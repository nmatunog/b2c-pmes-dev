import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Validates `ADMIN_EMAIL` and bcrypt `ADMIN_PASSWORD_HASH` from env, then issues the same admin JWT as before.
   */
  async adminLogin(email: string, password: string): Promise<{ accessToken: string; expiresIn: string }> {
    const configEmail = this.config.get<string>("ADMIN_EMAIL")?.trim().toLowerCase();
    const hash = this.config.get<string>("ADMIN_PASSWORD_HASH")?.trim();
    if (!configEmail || !hash) {
      throw new UnauthorizedException("Admin sign-in is not configured");
    }
    const given = email?.trim().toLowerCase();
    if (!given || given !== configEmail) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const ok = await bcrypt.compare(password ?? "", hash);
    if (!ok) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const accessToken = this.jwt.sign({ role: "admin" });
    return { accessToken, expiresIn: "8h" };
  }
}

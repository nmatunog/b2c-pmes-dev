import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { AdminCredentialsDto } from "./dto/admin-credentials.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Exchange admin email + password (checked against env) for a short-lived JWT. */
  @Post("admin/login")
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  adminLogin(@Body() dto: AdminCredentialsDto) {
    return this.auth.adminLogin(dto.email, dto.password);
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/** Bearer token for B2C-Store → WebApp service calls. */
@Injectable()
export class StoreIntegrationGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = String(this.config.get<string>("STORE_INTEGRATION_SECRET") ?? "").trim();
    if (!expected) {
      throw new UnauthorizedException("Store integration is not configured (STORE_INTEGRATION_SECRET)");
    }

    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers.authorization;
    const header = String(Array.isArray(raw) ? raw[0] : raw ?? "");
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid store integration credentials");
    }
    return true;
  }
}

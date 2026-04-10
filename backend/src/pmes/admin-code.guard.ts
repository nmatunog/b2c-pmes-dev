import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

/** Same algorithm as the legacy client prompt: B2C + MMDDYYYY (server local date). */
@Injectable()
export class AdminCodeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = req.headers["x-admin-code"];
    const code = String(Array.isArray(raw) ? raw[0] : raw ?? "").trim();
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const expected = `B2C${mm}${dd}${now.getFullYear()}`;
    if (code !== expected) {
      throw new UnauthorizedException("Invalid admin code");
    }
    return true;
  }
}

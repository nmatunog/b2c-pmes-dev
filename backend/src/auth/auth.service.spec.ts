import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  const testPassword = "test-admin-password-ok";
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(testPassword, 4);
  });

  beforeEach(async () => {
    jwt = { sign: jest.fn(() => "test.jwt.token"), verify: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "ADMIN_EMAIL") return "admin@example.com";
              if (key === "ADMIN_PASSWORD_HASH") return passwordHash;
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it("adminLogin rejects wrong email", async () => {
    await expect(service.adminLogin("other@example.com", testPassword)).rejects.toThrow(UnauthorizedException);
  });

  it("adminLogin rejects wrong password", async () => {
    await expect(service.adminLogin("admin@example.com", "wrong")).rejects.toThrow(UnauthorizedException);
  });

  it("adminLogin accepts valid email and password", async () => {
    const out = await service.adminLogin("admin@example.com", testPassword);
    expect(out.accessToken).toBe("test.jwt.token");
    expect(jwt.sign).toHaveBeenCalledWith({ role: "admin" });
  });
});

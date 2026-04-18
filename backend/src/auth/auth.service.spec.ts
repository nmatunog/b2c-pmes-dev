import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { StaffRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuthService", () => {
  let service: AuthService;
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  const testPassword = "test-admin-password-ok";
  let passwordHash: string;

  const prismaMock = {
    staffUser: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(testPassword, 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jwt = { sign: jest.fn(() => "test.jwt.token"), verify: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: () => "x".repeat(32) } },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it("staffLogin rejects unknown email", async () => {
    prismaMock.staffUser.findUnique.mockResolvedValue(null);
    await expect(service.staffLogin("a@b.com", testPassword)).rejects.toThrow(UnauthorizedException);
  });

  it("staffLogin rejects wrong password", async () => {
    prismaMock.staffUser.findUnique.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      passwordHash,
      role: StaffRole.ADMIN,
    });
    await expect(service.staffLogin("admin@example.com", "wrong")).rejects.toThrow(UnauthorizedException);
  });

  it("staffLogin accepts admin and returns role admin", async () => {
    prismaMock.staffUser.findUnique.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      passwordHash,
      role: StaffRole.ADMIN,
    });
    const out = await service.staffLogin("admin@example.com", testPassword);
    expect(out.role).toBe("admin");
    expect(out.dbRole).toBe(StaffRole.ADMIN);
    expect(out.accessToken).toBe("test.jwt.token");
    expect(jwt.sign).toHaveBeenCalledWith({ role: "admin", sub: "u1" });
  });

  it("staffLogin accepts superuser and returns role superuser", async () => {
    prismaMock.staffUser.findUnique.mockResolvedValue({
      id: "s1",
      email: "boss@example.com",
      passwordHash,
      role: StaffRole.SUPERUSER,
    });
    const out = await service.staffLogin("boss@example.com", testPassword);
    expect(out.role).toBe("superuser");
    expect(out.dbRole).toBe(StaffRole.SUPERUSER);
    expect(jwt.sign).toHaveBeenCalledWith({ role: "superuser", sub: "s1" });
  });
});

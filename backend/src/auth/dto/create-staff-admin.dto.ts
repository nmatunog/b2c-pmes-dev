import { StaffRole } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateStaffAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** ADMIN (default), TREASURER, BOARD_DIRECTOR, or SECRETARY — superuser only. */
  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;
}

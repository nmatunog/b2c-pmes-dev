import { IsEmail, IsEnum, IsString, MaxLength } from "class-validator";
import { StaffRole } from "@prisma/client";

/** Superuser: set officer/admin role for the staff account whose email matches a member. */
export class SetMemberStaffPositionDto {
  @IsEmail()
  @MaxLength(320)
  memberEmail!: string;

  /** Must match an existing staff account for that email (create one in Admin accounts first). */
  @IsEnum(StaffRole)
  role!: StaffRole;
}

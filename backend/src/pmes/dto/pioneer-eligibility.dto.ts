import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class PioneerEligibilityDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  /** Must match the DOB on file (same format as stored on the participant row, e.g. YYYY-MM-DD). */
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  dob!: string;
}

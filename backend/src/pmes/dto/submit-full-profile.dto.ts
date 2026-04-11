import { IsEmail, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class SubmitFullProfileDto {
  @IsEmail()
  email!: string;

  /** Arbitrary key-value profile fields from the official member sheet */
  @IsObject()
  fields!: Record<string, string>;

  @IsOptional()
  @IsString()
  @MinLength(0)
  sheetFileName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

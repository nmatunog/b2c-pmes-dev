import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

/** Full B2C membership form as JSON string (nested sections from the official sheet). */
export class SubmitFullProfileDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  profileJson!: string;

  @IsOptional()
  @IsString()
  sheetFileName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

/**
 * Legacy / B2C registry import. Core identity can come from `fullName` or from
 * lastName + firstName (+ middleName) as in the cooperative spreadsheet.
 * Optional `sheet` holds any extra columns (passthrough) for audit.
 */
export class ImportLegacyPioneerRowDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  middleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  phone?: string;

  /** Prefer YYYY-MM-DD (reclaim form). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gender?: string;

  /** Spreadsheet column "Sex/Gender" */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sexGender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registryTimestamp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  civilStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  barangay?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cityMunicipality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tinNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  initialSubscriptionAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paidUpShareAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  religion?: string;

  /** Any additional spreadsheet columns (merged into registryImportSnapshot). */
  @IsOptional()
  @IsObject()
  sheet?: Record<string, unknown>;
}

export class ImportLegacyPioneersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportLegacyPioneerRowDto)
  rows!: ImportLegacyPioneerRowDto[];
}

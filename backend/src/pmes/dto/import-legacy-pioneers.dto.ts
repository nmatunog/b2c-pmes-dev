import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEmail, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";

export class ImportLegacyPioneerRowDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  fullName!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(80)
  phone!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  dob!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  gender!: string;
}

export class ImportLegacyPioneersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportLegacyPioneerRowDto)
  rows!: ImportLegacyPioneerRowDto[];
}

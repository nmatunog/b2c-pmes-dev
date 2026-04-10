import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreatePmesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  fullName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MaxLength(64)
  phone!: string;

  @IsString()
  @MaxLength(32)
  dob!: string;

  @IsString()
  @MaxLength(32)
  gender!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  score!: number;

  @IsBoolean()
  passed!: boolean;
}

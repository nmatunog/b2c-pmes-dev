import { Type } from "class-transformer";
import { IsEmail, IsNumber, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateLoiDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  address!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  occupation!: string;

  @IsString()
  @MaxLength(500)
  employer!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCapital!: number;
}

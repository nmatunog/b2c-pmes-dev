import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Limits repeated narration abuse and caps token-ish payload size. */
export class TtsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  voice?: string;
}

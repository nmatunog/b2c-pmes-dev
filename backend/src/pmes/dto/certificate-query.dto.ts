import { IsEmail, IsString, MaxLength } from "class-validator";

export class CertificateQueryDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MaxLength(32)
  dob!: string;
}

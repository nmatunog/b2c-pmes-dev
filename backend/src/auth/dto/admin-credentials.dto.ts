import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class AdminCredentialsDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

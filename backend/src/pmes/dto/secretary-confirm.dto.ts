import { IsUUID } from "class-validator";

export class SecretaryConfirmDto {
  @IsUUID()
  participantId!: string;
}

import { IsBoolean, IsUUID } from "class-validator";

export class BodVoteDto {
  @IsUUID()
  participantId!: string;

  @IsBoolean()
  approve!: boolean;
}

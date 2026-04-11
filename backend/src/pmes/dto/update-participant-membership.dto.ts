import { IsBoolean, IsOptional, IsUUID } from "class-validator";

/** Staff confirms treasury receipt and/or Board approval */
export class UpdateParticipantMembershipDto {
  @IsUUID()
  participantId!: string;

  @IsOptional()
  @IsBoolean()
  initialFeesPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  boardApproved?: boolean;
}

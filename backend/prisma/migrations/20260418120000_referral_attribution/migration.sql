-- Referral link attribution (PIONEER-xxxxxxxx) and one-time credit when referee becomes full member.
ALTER TABLE "Participant" ADD COLUMN "referredByParticipantId" TEXT;
ALTER TABLE "Participant" ADD COLUMN "referralJoinCreditedAt" TIMESTAMP(3);

ALTER TABLE "Participant"
  ADD CONSTRAINT "Participant_referredByParticipantId_fkey"
  FOREIGN KEY ("referredByParticipantId") REFERENCES "Participant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Participant_referredByParticipantId_idx" ON "Participant"("referredByParticipantId");

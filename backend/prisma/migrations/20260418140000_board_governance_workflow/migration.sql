-- Officer roles + BOD voting + Board Resolution serials
ALTER TYPE "StaffRole" ADD VALUE 'TREASURER';
ALTER TYPE "StaffRole" ADD VALUE 'BOARD_DIRECTOR';
ALTER TYPE "StaffRole" ADD VALUE 'SECRETARY';

ALTER TABLE "Participant" ADD COLUMN "bodMajorityReachedAt" TIMESTAMP(3);
ALTER TABLE "Participant" ADD COLUMN "boardResolutionNo" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Participant_boardResolutionNo_key" ON "Participant"("boardResolutionNo");

CREATE TABLE "BoardApprovalVote" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "participantId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "approve" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardApprovalVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardApprovalVote_participantId_staffUserId_key" ON "BoardApprovalVote"("participantId", "staffUserId");
CREATE INDEX "BoardApprovalVote_participantId_idx" ON "BoardApprovalVote"("participantId");

ALTER TABLE "BoardApprovalVote" ADD CONSTRAINT "BoardApprovalVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardApprovalVote" ADD CONSTRAINT "BoardApprovalVote_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BoardResolutionCounter" (
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BoardResolutionCounter_pkey" PRIMARY KEY ("year","month")
);

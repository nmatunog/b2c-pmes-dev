-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "boardApprovedAt" TIMESTAMP(3),
ADD COLUMN     "fullProfileCompletedAt" TIMESTAMP(3),
ADD COLUMN     "fullProfileJson" TEXT,
ADD COLUMN     "initialFeesPaidAt" TIMESTAMP(3);

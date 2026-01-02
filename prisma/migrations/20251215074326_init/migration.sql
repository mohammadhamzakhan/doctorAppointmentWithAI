-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "emailChangeCodeNew" TEXT,
ADD COLUMN     "emailChangeCodeOld" TEXT,
ADD COLUMN     "emailChangeExpiry" TIMESTAMP(3),
ADD COLUMN     "pendingEmail" TEXT;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "emailChangeCodeNew" TEXT,
ADD COLUMN     "emailChangeCodeOld" TEXT,
ADD COLUMN     "emailChangeExpiry" TIMESTAMP(3),
ADD COLUMN     "pendingEmail" TEXT;

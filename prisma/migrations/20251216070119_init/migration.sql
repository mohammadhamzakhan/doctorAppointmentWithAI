/*
  Warnings:

  - You are about to drop the column `emailChangeCodeNew` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `emailChangeCodeOld` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `pendingEmail` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `emailChangeCodeNew` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `emailChangeCodeOld` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `pendingEmail` on the `Doctor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "emailChangeCodeNew",
DROP COLUMN "emailChangeCodeOld",
DROP COLUMN "pendingEmail",
ADD COLUMN     "emailChangeCode" TEXT,
ADD COLUMN     "passwordResetCode" TEXT;

-- AlterTable
ALTER TABLE "Doctor" DROP COLUMN "emailChangeCodeNew",
DROP COLUMN "emailChangeCodeOld",
DROP COLUMN "pendingEmail",
ADD COLUMN     "emailChangeCode" TEXT,
ADD COLUMN     "passwordResetCode" TEXT;

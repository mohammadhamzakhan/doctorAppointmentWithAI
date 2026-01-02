/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumberId]` on the table `Doctor` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "phoneNumberId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_phoneNumberId_key" ON "Doctor"("phoneNumberId");

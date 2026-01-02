/*
  Warnings:

  - You are about to drop the column `specialty` on the `Doctor` table. All the data in the column will be lost.
  - Added the required column `specialization` to the `Doctor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_assistantId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_patientId_fkey";

-- DropForeignKey
ALTER TABLE "assistant" DROP CONSTRAINT "assistant_doctorId_fkey";

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "hashToken" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Admin';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "appointmentStatus" "AppointmentStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Doctor" DROP COLUMN "specialty",
ADD COLUMN     "hashToken" TEXT,
ADD COLUMN     "specialization" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "assistant" ADD COLUMN     "hashToken" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");

-- CreateIndex
CREATE INDEX "Appointment_assistantId_idx" ON "Appointment"("assistantId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "assistant_doctorId_idx" ON "assistant"("doctorId");

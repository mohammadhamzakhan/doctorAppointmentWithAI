/*
  Warnings:

  - A unique constraint covering the columns `[doctorId,scheduledStart]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bookedBy` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expectedDuration` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `queueNumber` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledEnd` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledStart` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ai', 'doctor', 'assistant', 'patient');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'rescheduled';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "actualDuration" INTEGER,
ADD COLUMN     "actualEnd" TIMESTAMP(3),
ADD COLUMN     "actualStart" TIMESTAMP(3),
ADD COLUMN     "bookedBy" "BookingSource" NOT NULL,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "expectedDuration" INTEGER NOT NULL,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNoShow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "queueNumber" INTEGER NOT NULL,
ADD COLUMN     "scheduledEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "scheduledStart" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "assistantId" DROP NOT NULL,
ALTER COLUMN "reason" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Appointment_appointmentDate_idx" ON "Appointment"("appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_queueNumber_idx" ON "Appointment"("queueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_doctorId_scheduledStart_key" ON "Appointment"("doctorId", "scheduledStart");

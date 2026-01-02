/*
  Warnings:

  - You are about to drop the column `timezode` on the `Doctor` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('FIXED', 'QUEUE');

-- AlterTable
ALTER TABLE "Doctor" DROP COLUMN "timezode",
ADD COLUMN     "bookingDisabledUntil" TIMESTAMP(3),
ADD COLUMN     "bookingMode" "BookingMode" NOT NULL DEFAULT 'QUEUE',
ADD COLUMN     "dailyBufferMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "isBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxAppointmentsPerDay" INTEGER NOT NULL DEFAULT 32,
ADD COLUMN     "scheduleLockedUntil" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/karachi';

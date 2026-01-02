-- CreateTable
CREATE TABLE "MessageLog" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "patientId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageLog_doctorId_idx" ON "MessageLog"("doctorId");

-- CreateIndex
CREATE INDEX "MessageLog_patientId_idx" ON "MessageLog"("patientId");

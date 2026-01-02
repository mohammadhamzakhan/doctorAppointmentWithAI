-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "isEmailVerifeid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "isEmailVerifeid" BOOLEAN NOT NULL DEFAULT false;

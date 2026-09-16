-- CreateEnum
CREATE TYPE "EmailSource" AS ENUM ('SCRAPED', 'HUNTER', 'AI_GUESSED');

-- AlterTable
ALTER TABLE "JobListing" ADD COLUMN     "emailSource" "EmailSource";

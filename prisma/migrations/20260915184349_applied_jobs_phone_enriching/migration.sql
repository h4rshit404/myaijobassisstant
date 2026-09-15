-- AlterEnum
ALTER TYPE "SearchStatus" ADD VALUE 'ENRICHING';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "phone" TEXT;

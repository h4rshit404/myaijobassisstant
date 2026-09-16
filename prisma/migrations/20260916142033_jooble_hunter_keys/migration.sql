-- AlterTable
ALTER TABLE "ApiKeySet" ADD COLUMN     "hunterApiKeyAuthTag" TEXT,
ADD COLUMN     "hunterApiKeyEncrypted" TEXT,
ADD COLUMN     "hunterApiKeyIv" TEXT,
ADD COLUMN     "joobleApiKeyAuthTag" TEXT,
ADD COLUMN     "joobleApiKeyEncrypted" TEXT,
ADD COLUMN     "joobleApiKeyIv" TEXT;

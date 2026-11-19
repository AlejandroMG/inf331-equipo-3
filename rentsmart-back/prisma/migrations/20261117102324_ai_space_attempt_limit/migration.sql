ALTER TABLE "AiSpaceGeneration"
    ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "AiSpaceGeneration"
SET "attemptCount" = 1
WHERE "completedAt" IS NOT NULL OR "description" IS NOT NULL;

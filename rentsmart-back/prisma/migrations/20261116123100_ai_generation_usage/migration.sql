CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiGeneration_userId_createdAt_idx"
    ON "AiGeneration"("userId", "createdAt");

ALTER TABLE "AiGeneration"
    ADD CONSTRAINT "AiGeneration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiGeneration"
    ADD CONSTRAINT "AiGeneration_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "Space"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiSpaceGeneration" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "leaseExpiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiSpaceGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiSpaceGeneration_spaceId_key"
    ON "AiSpaceGeneration"("spaceId");

CREATE UNIQUE INDEX "AiSpaceGeneration_attemptId_key"
    ON "AiSpaceGeneration"("attemptId");

CREATE INDEX "AiSpaceGeneration_leaseExpiresAt_idx"
    ON "AiSpaceGeneration"("leaseExpiresAt");

ALTER TABLE "AiSpaceGeneration"
    ADD CONSTRAINT "AiSpaceGeneration_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "Space"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiSpaceGeneration"
    ADD CONSTRAINT "AiSpaceGeneration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

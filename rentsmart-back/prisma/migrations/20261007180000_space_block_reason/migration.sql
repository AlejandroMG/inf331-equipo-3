-- AD-02: por qué un administrador despublicó (bloqueó) un espacio, y cuándo.
ALTER TABLE "Space" ADD COLUMN "blockedReason" TEXT,
  ADD COLUMN "blockedAt" TIMESTAMP(3);

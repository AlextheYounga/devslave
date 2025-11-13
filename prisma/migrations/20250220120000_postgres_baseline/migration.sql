-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AgentStatus" AS ENUM ('PREPARING', 'LAUNCHED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ProjectPhase" AS ENUM ('DESIGN', 'PLANNING', 'DEVELOPMENT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'QA_REVIEW', 'QA_CHANGES_REQUESTED', 'CLOSED');

-- CreateTable
CREATE TABLE "public"."agents" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "tmuxSession" TEXT,
    "codebaseId" TEXT,
    "role" TEXT,
    "logFile" TEXT,
    "prompt" TEXT,
    "model" TEXT NOT NULL DEFAULT 'default',
    "data" JSONB,
    "status" "public"."AgentStatus" NOT NULL DEFAULT 'PREPARING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."codebases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "setup" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "phase" "public"."ProjectPhase" NOT NULL DEFAULT 'DESIGN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codebases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets" (
    "id" TEXT NOT NULL,
    "codebaseId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ticketFile" TEXT NOT NULL,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."agents" ADD CONSTRAINT "agents_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "public"."codebases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "public"."codebases"("id") ON DELETE CASCADE ON UPDATE CASCADE;


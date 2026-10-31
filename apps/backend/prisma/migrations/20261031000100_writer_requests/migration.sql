-- CreateEnum
CREATE TYPE "WriterRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "writer_requests" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" "WriterRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewed_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "writer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IDX_writer_requests_status_created_at" ON "writer_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_writer_requests_user_pending" ON "writer_requests"("user_id") WHERE (status = 'PENDING');

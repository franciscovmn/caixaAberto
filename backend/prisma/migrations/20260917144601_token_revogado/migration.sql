-- CreateTable
CREATE TABLE "TOKEN_REVOGADO" (
    "id" BIGSERIAL NOT NULL,
    "hash_token" VARCHAR(64) NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "expira_em" TIMESTAMP(6) NOT NULL,
    "data_revogacao" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "TOKEN_REVOGADO_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TOKEN_REVOGADO_hash_token_key" ON "TOKEN_REVOGADO"("hash_token");

-- CreateIndex
CREATE INDEX "TOKEN_REVOGADO_expira_em_idx" ON "TOKEN_REVOGADO"("expira_em");

-- AddForeignKey
ALTER TABLE "TOKEN_REVOGADO" ADD CONSTRAINT "TOKEN_REVOGADO_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "USUARIO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

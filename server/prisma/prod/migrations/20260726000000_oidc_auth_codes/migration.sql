-- One-time authorization codes for the OIDC provider (LAILA as identity
-- provider). `code` is the PRIMARY KEY so redeeming is an atomic single-use
-- delete: a racing second redemption finds no row instead of replaying a login.
-- Rows are short-lived (60s) and swept opportunistically on each mint.

-- CreateTable
CREATE TABLE "oidc_auth_codes" (
    "code" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "client_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "nonce" TEXT,
    "code_challenge" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oidc_auth_codes_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "oidc_auth_codes_expires_at_idx" ON "oidc_auth_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "oidc_auth_codes" ADD CONSTRAINT "oidc_auth_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

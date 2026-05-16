-- ============================================================
--  MTA STORE — Banco de Dados PostgreSQL
--  Compatível com: Neon, Railway, Supabase, ElephantSQL
--
--  Como usar no Neon/Railway:
--    Cole no SQL Editor e clique em Run.
--
--  Via terminal:
--    psql "$DATABASE_URL" -f database_setup.sql
--
--  ATENÇÃO: O projeto usa Drizzle ORM.
--  Se preferir, rode só: npm run db:push
--  (ele cria todas as tabelas automaticamente)
-- ============================================================

-- UUID nativo do PostgreSQL (sem extensão pgcrypto)
-- gen_random_uuid() está disponível por padrão no PostgreSQL 13+

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS "users" (
    "id"                    VARCHAR       PRIMARY KEY DEFAULT gen_random_uuid(),
    "username"              TEXT          NOT NULL UNIQUE,
    "email"                 TEXT          NOT NULL UNIQUE,
    "password"              TEXT          NOT NULL,
    "mta_serial"            TEXT,
    "mta_account"           TEXT,
    "is_admin"              BOOLEAN       NOT NULL DEFAULT FALSE,
    "is_vip"                BOOLEAN       NOT NULL DEFAULT FALSE,
    "vip_expires_at"        TIMESTAMP,
    "coin_balance"          INTEGER       NOT NULL DEFAULT 0,
    "stripe_customer_id"    TEXT,
    "created_at"            TIMESTAMP     NOT NULL DEFAULT NOW(),
    -- Segurança
    "failed_login_attempts" INTEGER       NOT NULL DEFAULT 0,
    "locked_until"          TIMESTAMP,
    "is_suspended"          BOOLEAN       NOT NULL DEFAULT FALSE,
    "suspended_reason"      TEXT,
    "last_login_at"         TIMESTAMP,
    "last_login_ip"         TEXT
);

CREATE INDEX IF NOT EXISTS "idx_users_username"     ON "users" ("username");
CREATE INDEX IF NOT EXISTS "idx_users_email"        ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_users_locked_until" ON "users" ("locked_until");

-- ============================================================
-- 2. USER_SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "user_sessions" (
    "id"             VARCHAR    PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"        VARCHAR    NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "session_token"  TEXT       NOT NULL UNIQUE,
    "ip_address"     TEXT,
    "user_agent"     TEXT,
    "device_name"    TEXT,
    "created_at"     TIMESTAMP  NOT NULL DEFAULT NOW(),
    "last_seen_at"   TIMESTAMP  NOT NULL DEFAULT NOW(),
    "expires_at"     TIMESTAMP  NOT NULL,
    "is_revoked"     BOOLEAN    NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "user_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_token"   ON "user_sessions" ("session_token");
CREATE INDEX IF NOT EXISTS "idx_sessions_active"  ON "user_sessions" ("user_id", "is_revoked", "expires_at");

-- ============================================================
-- 3. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS "products" (
    "id"             VARCHAR        PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"           TEXT           NOT NULL,
    "description"    TEXT,
    "sku"            TEXT           NOT NULL UNIQUE,
    "price"          DECIMAL(10,2)  NOT NULL,
    "currency"       TEXT           NOT NULL DEFAULT 'BRL',
    "category"       TEXT           NOT NULL,
    "image_url"      TEXT,
    "mta_command"    TEXT           NOT NULL,
    "mta_params"     JSONB,
    "is_active"      BOOLEAN        NOT NULL DEFAULT TRUE,
    "stock_quantity" INTEGER,
    "created_at"     TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products" ("category");
CREATE INDEX IF NOT EXISTS "idx_products_active"   ON "products" ("is_active");

-- ============================================================
-- 4. TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "transactions" (
    "id"                          VARCHAR        PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"                     VARCHAR        NOT NULL REFERENCES "users" ("id"),
    "product_id"                  VARCHAR        REFERENCES "products" ("id") ON DELETE SET NULL,
    "stripe_payment_intent_id"    TEXT,
    "stripe_checkout_session_id"  TEXT,
    "amount"                      DECIMAL(10,2)  NOT NULL,
    "currency"                    TEXT           NOT NULL DEFAULT 'BRL',
    "status"                      TEXT           NOT NULL DEFAULT 'pending',
    "payment_method"              TEXT,
    "mta_activation_status"       TEXT           NOT NULL DEFAULT 'pending',
    "mta_activation_error"        TEXT,
    "mta_activation_attempts"     INTEGER        NOT NULL DEFAULT 0,
    "metadata"                    JSONB,
    "purchase_ip"                 TEXT,
    "is_suspicious"               BOOLEAN        NOT NULL DEFAULT FALSE,
    "suspicious_reason"           TEXT,
    "created_at"                  TIMESTAMP      NOT NULL DEFAULT NOW(),
    "updated_at"                  TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_transactions_user_id"       ON "transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_status"        ON "transactions" ("status");
CREATE INDEX IF NOT EXISTS "idx_transactions_stripe"        ON "transactions" ("stripe_checkout_session_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_created_at"    ON "transactions" ("created_at" DESC);

-- updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS "trg_transactions_updated_at" ON "transactions";
CREATE TRIGGER "trg_transactions_updated_at"
    BEFORE UPDATE ON "transactions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. SYSTEM_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS "system_logs" (
    "id"             VARCHAR    PRIMARY KEY DEFAULT gen_random_uuid(),
    "type"           TEXT       NOT NULL,
    "level"          TEXT       NOT NULL DEFAULT 'info',
    "message"        TEXT       NOT NULL,
    "user_id"        VARCHAR    REFERENCES "users" ("id") ON DELETE SET NULL,
    "transaction_id" VARCHAR    REFERENCES "transactions" ("id") ON DELETE SET NULL,
    "metadata"       JSONB,
    "ip_address"     TEXT,
    "user_agent"     TEXT,
    "created_at"     TIMESTAMP  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_logs_type"       ON "system_logs" ("type");
CREATE INDEX IF NOT EXISTS "idx_logs_level"      ON "system_logs" ("level");
CREATE INDEX IF NOT EXISTS "idx_logs_user_id"    ON "system_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_logs_created_at" ON "system_logs" ("created_at" DESC);

-- ============================================================
-- 6. MTA_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS "mta_settings" (
    "id"                VARCHAR    PRIMARY KEY DEFAULT gen_random_uuid(),
    "server_url"        TEXT       NOT NULL,
    "server_port"       INTEGER    NOT NULL DEFAULT 22005,
    "api_token"         TEXT       NOT NULL,
    "is_active"         BOOLEAN    NOT NULL DEFAULT TRUE,
    "last_health_check" TIMESTAMP,
    "health_status"     TEXT       NOT NULL DEFAULT 'unknown',
    "created_at"        TIMESTAMP  NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMP  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS "trg_mta_settings_updated_at" ON "mta_settings";
CREATE TRIGGER "trg_mta_settings_updated_at"
    BEFORE UPDATE ON "mta_settings"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

-- Admin padrão: login admin / senha admin123
-- TROQUE A SENHA após o primeiro acesso!
INSERT INTO "users" ("username", "email", "password", "is_admin")
VALUES (
    'admin',
    'admin@mtastore.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    TRUE
) ON CONFLICT ("username") DO NOTHING;

-- Produtos de exemplo
INSERT INTO "products" ("name", "description", "sku", "price", "currency", "category", "mta_command", "mta_params", "is_active")
VALUES
('VIP Bronze - 30 dias', 'Tag especial e benefícios exclusivos.',
 'VIP-BRONZE-30', 29.90, 'BRL', 'vip', 'giveVip', '{"days": 30}', TRUE),

('VIP Prata - 30 dias', 'Mais benefícios e comandos exclusivos.',
 'VIP-SILVER-30', 49.90, 'BRL', 'vip', 'giveVip', '{"days": 30, "tier": "silver"}', TRUE),

('VIP Ouro - 30 dias', 'Todos os benefícios e skin exclusiva.',
 'VIP-GOLD-30', 89.90, 'BRL', 'vip', 'giveVip', '{"days": 30, "tier": "gold"}', TRUE),

('1.000 Moedas', 'Pacote básico de moedas.',
 'COINS-1000', 9.90, 'BRL', 'coins', 'giveCoins', '{"amount": 1000}', TRUE),

('5.000 Moedas', 'Com bônus de 500 moedas.',
 'COINS-5000', 39.90, 'BRL', 'coins', 'giveCoins', '{"amount": 5500}', TRUE),

('15.000 Moedas', 'Pacote premium com bônus de 3.000.',
 'COINS-15000', 99.90, 'BRL', 'coins', 'giveCoins', '{"amount": 18000}', TRUE),

('Sultan RS', 'O Sultan RS tunado no seu spawn.',
 'CAR-SULTAN', 19.90, 'BRL', 'vehicle', 'giveVehicle', '{"vehicleId": 560}', TRUE),

('Infernus', 'O carro mais rápido do jogo.',
 'CAR-INFERNUS', 24.90, 'BRL', 'vehicle', 'giveVehicle', '{"vehicleId": 411}', TRUE),

('Kit Armas Iniciante', 'Pistola, SMG e Rifle.',
 'KIT-STARTER', 14.90, 'BRL', 'item', 'giveWeaponKit', '{"kit": "starter"}', TRUE),

('Kit Armas Premium', 'Arsenal completo.',
 'KIT-PREMIUM', 34.90, 'BRL', 'item', 'giveWeaponKit', '{"kit": "premium"}', TRUE)

ON CONFLICT ("sku") DO NOTHING;

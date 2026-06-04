-- Insert / update MTA settings
-- Use no Neon/Railway/Supabase SQL editor

-- Versão compatível: 2 statements (UPDATE e depois INSERT se não houver linha)
-- Recomendado porque mta_settings.api_token não tem UNIQUE no schema atual.

UPDATE "mta_settings"
SET
  "server_url" = 'https://lemehost.com',
  "server_port" = 16254,
  "api_token" = '988CBCDD5B9CE9C19EBBE1268A151294',
  "is_active" = TRUE,
  "updated_at" = NOW()
;

INSERT INTO "mta_settings" (
  "server_url", "server_port", "api_token", "is_active"
)
SELECT
  'https://lemehost.com',
  16254,
  '988CBCDD5B9CE9C19EBBE1268A151294',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM "mta_settings");


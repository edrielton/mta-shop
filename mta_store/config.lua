-- MTA STORE - config.lua

-- Token secreto: igual ao do painel Admin > Configuracoes MTA
-- IMPORTANTE: Gere um token aleatorio de 32 caracteres e use o MESMO no .env (MTA_STORE_TOKEN)
MTA_STORE_TOKEN = "COLE_AQUI_SEU_TOKEN_DE_32_CHARS"

-- URL do site SEM barra no final
MTA_STORE_SITE_URL = "https://mtastore.site"

-- true = logs detalhados | false = producao
MTA_STORE_DEBUG = false

-- Prefixo das mensagens no chat
MTA_STORE_MSG_PREFIX = "#00FF7F[MTA Store] #FFFFFF"

-- ── Banco de dados MySQL (para sync.lua) ─────────────────────────────
-- Use variaveis de ambiente ou substitua pelos valores reais
-- Nunca commite credenciais no Git
MTA_DB_HOST = "127.0.0.1"
MTA_DB_PORT = 3306
MTA_DB_USER = "root"
MTA_DB_PASS = "SUA_SENHA_MYSQL_AQUI"
MTA_DB_NAME = "mta_store"

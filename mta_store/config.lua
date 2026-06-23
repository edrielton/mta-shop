-- MTA STORE - config.lua

-- Token secreto: igual ao do painel Admin > Configuracoes MTA
-- IMPORTANTE: Gere um token aleatorio de 32 caracteres e use o MESMO no .env (MTA_STORE_TOKEN)
MTA_STORE_TOKEN = "988CBCDD5B9CE9C19EBBE1268A151294"

-- URL do site SEM barra no final
MTA_STORE_SITE_URL = "https://mtastore.site"

-- true = logs detalhados | false = producao
MTA_STORE_DEBUG = false

-- Prefixo das mensagens no chat
MTA_STORE_MSG_PREFIX = "#00FF7F[MTA Store] #FFFFFF"

-- ── Banco de dados MySQL (para sync.lua) ─────────────────────────────
-- Use variaveis de ambiente ou substitua pelos valores reais
-- Nunca commite credenciais no Git
MTA_DB_HOST = "135.148.164.122"
MTA_DB_PORT = 3306
MTA_DB_USER = "u218358_VfhEcGyBlz"
MTA_DB_PASS = "LQdWGN3Be+Uods2PFW@QGzDw"
MTA_DB_NAME = "s218358_db1782173595273"

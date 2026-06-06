-- MTA STORE - config.lua

-- Token secreto: igual ao do painel Admin > Configuracoes MTA
MTA_STORE_TOKEN = "988CBCDD5B9CE9C19EBBE1268A151294988CBCDD5B9CE9C19EBBE1268A151294"

-- URL do site SEM barra no final
MTA_STORE_SITE_URL = "https://mtastore.site"

-- true = logs detalhados | false = producao
MTA_STORE_DEBUG = false

-- Prefixo das mensagens no chat
MTA_STORE_MSG_PREFIX = "#00FF7F[MTA Store] #FFFFFF"

-- ── Banco de dados MySQL (para sync.lua) ─────────────────────────────
-- Mesmas credenciais do seu servidor MTA (mtaserver.conf ou gamemode)
MTA_DB_HOST = "127.0.0.1"   -- host do MySQL
MTA_DB_PORT = 3306           -- porta
MTA_DB_USER = "root"         -- usuario
MTA_DB_PASS = "07182402"    -- senha
MTA_DB_NAME = "mta_store" -- nome do banco (onde fica a tabela jogadores)

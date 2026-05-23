--[[
    MTA STORE - config.lua v1.3
    =====================================================================
    Configure este arquivo antes de iniciar o resource.
    =====================================================================
--]]

-- ── Autenticação ───────────────────────────────────────────────────────
-- Token secreto: deve ser IGUAL ao configurado no painel admin do site
MTA_STORE_TOKEN = 988CBCDD5B9CE9C19EBBE1268A151294

-- ── URL do seu site ────────────────────────────────────────────────────
-- SEM barra no final!
-- Exemplo: "https://meuservidor.com.br" ou "https://meuservidor.railway.app"
MTA_STORE_SITE_URL = https://mta-shop-production.up.railway.app/

-- ── Verificação HMAC ──────────────────────────────────────────────────
-- Recomendado: true (segurança extra nas requisições)
MTA_STORE_REQUIRE_HMAC = true

-- ── Debug ─────────────────────────────────────────────────────────────
-- false em produção | true para ver logs detalhados no console MTA
MTA_STORE_DEBUG = false

-- ── Mensagens no chat dos jogadores ───────────────────────────────────
MTA_STORE_MSGS = {
    success       = "#00FF7F[MTA Store] #FFFFFFItem ativado com sucesso! Obrigado pela compra.",
    offline_queue = "#00FF7F[MTA Store] #FFFFFFVocê tem itens pendentes sendo ativados...",
    vip_granted   = "#FFD700[MTA Store] #FFFFFFSeu VIP foi ativado! Aproveite os benefícios!",
    coins_granted = "#00BFFF[MTA Store] #FFFFFFFF+%d moedas adicionadas à sua conta!",
    car_granted   = "#FF6600[MTA Store] #FFFFFFVeículo adicionado ao seu garagem!",
    skin_granted  = "#CC66FF[MTA Store] #FFFFFFSua skin foi alterada com sucesso!",
    weapon_granted= "#FF4444[MTA Store] #FFFFFFKit de armas entregue!",
    store_link    = "#00FF7F[MTA Store] #FFFFFFDigite #00BFFF/loja #FFFFFFpara acessar a loja online!",
}

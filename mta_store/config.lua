--[[
    MTA STORE - config.lua
    =====================================================================
    Configure este arquivo com o mesmo token definido no painel admin
    do site (Admin > Configurações MTA).
    
    IMPORTANTE: Este token deve ser idêntico ao "API Token" configurado
    no painel administrativo do site.
    =====================================================================
--]]

-- Token de autenticação (deve ser igual ao configurado no painel admin do site)
MTA_STORE_TOKEN = "change-this-token-in-production"

-- Verificação de assinatura HMAC (recomendado: true)
-- Se true, verifica a assinatura criptográfica de cada requisição
MTA_STORE_REQUIRE_HMAC = true

-- Modo debug (false em produção)
-- Se true, exibe mensagens detalhadas no debug do MTA
MTA_STORE_DEBUG = false

-- Mensagens de notificação para os jogadores (personalize à vontade)
MTA_STORE_MSGS = {
    success       = "#00FF7F[MTA Store] #FFFFFFItem ativado com sucesso! Obrigado pela compra.",
    offline_queue = "#00FF7F[MTA Store] #FFFFFFVocê tem itens pendentes da loja sendo ativados...",
    vip_granted   = "#FFD700[MTA Store] #FFFFFFSeu VIP foi ativado! Aproveite os benefícios!",
    coins_granted = "#00BFFF[MTA Store] #FFFFFFFF+%d moedas adicionadas à sua conta!",
    car_granted   = "#FF6600[MTA Store] #FFFFFFVeículo adicionado! Procure no estacionamento VIP.",
    skin_granted  = "#CC66FF[MTA Store] #FFFFFFSua skin foi alterada com sucesso!",
    weapon_granted= "#FF4444[MTA Store] #FFFFFFKit de armas entregue!",
}

-- MTA STORE - sync.lua
-- Sync via elementData (sem banco de dados proprio)
-- Comandos: /loja | /store | /shop

local SYNC_INTERVAL = 30

local function log(msg)  outputServerLog("[MTA-Store Sync] " .. tostring(msg)) end
local function dbg(msg)  if MTA_STORE_DEBUG then outputDebugString("[MTA-Store] " .. tostring(msg), 3) end end
local function chat(p,m) outputChatBox(MTA_STORE_MSG_PREFIX .. m, p, 255, 255, 255, true) end

-- ── POST para o site ──────────────────────────────────────────────────
local function postToSite(endpoint, data, cb)
    fetchRemote(MTA_STORE_SITE_URL .. endpoint, {
        method         = "POST",
        postData       = toJSON(data),
        headers        = {
            ["Content-Type"] = "application/json",
            ["X-API-Token"]  = MTA_STORE_TOKEN,
        },
        connectTimeout = 10000,
        readTimeout    = 10000,
    }, function(response, errno)
        if errno ~= 0 then
            dbg("ERRO POST " .. endpoint .. " errno=" .. tostring(errno))
            return
        end
        if cb then cb(fromJSON(response)) end
    end)
end

-- ── Coleta dados via elementData e envia ao site ──────────────────────
-- Adapte os nomes dos elementData para os que seu gamemode usa
local function syncPlayer(player)
    if not isElement(player) then return end
    local serial = getPlayerSerial(player)
    local acc    = getPlayerAccount(player)
    local nome   = getElementData(player, "char:nome") or getPlayerName(player)

    postToSite("/api/player/sync", {
        serial       = serial,
        online       = true,
        updatedAt    = os.time(),
        nome         = nome,
        dinheiro     = getElementData(player, "dinheiro")      or getElementData(player, "money")    or 0,
        banco        = getElementData(player, "banco")         or getElementData(player, "bank")     or 0,
        faccao       = getElementData(player, "faccao")        or getElementData(player, "faction")  or "Nenhuma",
        cargo        = getElementData(player, "cargo")         or getElementData(player, "rank")     or "Membro",
        emprego      = getElementData(player, "emprego")       or getElementData(player, "job")      or "Desempregado",
        nivel        = getElementData(player, "nivel")         or getElementData(player, "level")    or 1,
        xp           = getElementData(player, "xp")           or 0,
        vida         = getElementData(player, "vida")          or getElementData(player, "health")   or getElementHealth(player),
        colete       = getElementData(player, "colete")        or getElementData(player, "armor")    or getPedArmor(player),
        skin         = getElementModel(player),
        vipAtivo     = getElementData(player, "vip:active")    or false,
        vipDias      = getElementData(player, "vip:days")      or 0,
        coins        = getElementData(player, "coins")         or 0,
        veiculos     = {},
        inventario   = {},
    }, nil)
end

-- ── Gera token de acesso rapido ao site ───────────────────────────────
local function sendToken(player)
    local serial = getPlayerSerial(player)
    local token  = hash("sha256", serial .. tostring(os.time()) .. tostring(math.random(1,999999))):sub(1,32)
    postToSite("/api/player/token", {serial=serial, token=token, expiresIn=300}, function(data)
        if data and data.success then
            local link = MTA_STORE_SITE_URL .. "/entrar?t=" .. token
            outputChatBox(MTA_STORE_MSG_PREFIX .. "Acesse sua conta:", player, 255, 255, 255, true)
            outputChatBox("#00BFFF" .. link, player, 255, 255, 255, true)
        else
            chat(player, "Erro ao gerar link. Tente novamente.")
        end
    end)
end

-- ── Eventos ───────────────────────────────────────────────────────────
addEventHandler("onPlayerLogin", root, function()
    local player = source
    setTimer(function()
        if isElement(player) then
            syncPlayer(player)
            sendToken(player)
        end
    end, 2000, 1)
end)

addEventHandler("onPlayerQuit", root, function()
    postToSite("/api/player/sync", {
        serial    = getPlayerSerial(source),
        online    = false,
        updatedAt = os.time(),
    }, nil)
end)

addEventHandler("onPlayerWasted", root, function()
    local player = source
    setTimer(function()
        if isElement(player) then syncPlayer(player) end
    end, 1000, 1)
end)

-- Sync periodico
setTimer(function()
    for _, p in ipairs(getElementsByType("player")) do
        local ref = p
        setTimer(function()
            if isElement(ref) then syncPlayer(ref) end
        end, math.random(500, 3000), 1)
    end
end, SYNC_INTERVAL * 1000, 0)

-- ── Comandos /loja /store /shop ───────────────────────────────────────
local function cmdLoja(player)
    if not player then return end
    local acc = getPlayerAccount(player)
    if not acc or isGuestAccount(acc) then
        chat(player, "Faca login numa conta MTA primeiro (/login).")
        return
    end
    chat(player, "Gerando seu link de acesso...")
    sendToken(player)
end

addCommandHandler("loja",  cmdLoja, false, false)
addCommandHandler("store", cmdLoja, false, false)
addCommandHandler("shop",  cmdLoja, false, false)

addEventHandler("onResourceStart", resourceRoot, function()
    log("Iniciado via elementData. /loja | /store | /shop")
end)

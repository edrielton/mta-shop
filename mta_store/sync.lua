-- MTA STORE - sync.lua (MTA nativo - sem oxmysql)
-- Usa dbConnect/dbQuery nativo do MTA SA
-- Comandos: /loja | /store | /shop

local SYNC_INTERVAL = 30
local db = nil

local function log(msg) outputServerLog("[MTA-Store Sync] " .. tostring(msg)) end
local function chat(player, msg) outputChatBox(MTA_STORE_MSG_PREFIX .. msg, player, 255, 255, 255, true) end

-- ── Conexao com o banco de dados ──────────────────────────────────────
-- Lê as credenciais do config.lua (adicione as variaveis abaixo no config.lua)
local function connectDB()
    if db then return db end
    -- Usa as variaveis definidas em config.lua
    local host = MTA_DB_HOST     or "127.0.0.1"
    local port = MTA_DB_PORT     or 3306
    local user = MTA_DB_USER     or "root"
    local pass = MTA_DB_PASS     or ""
    local name = MTA_DB_NAME     or "mta_roleplay"

    db = dbConnect("mysql", "dbname=" .. name .. ";host=" .. host .. ";port=" .. tostring(port), user, pass, "share=0;autoreconnect=1")
    if db then
        log("Banco de dados conectado: " .. host .. "/" .. name)
    else
        log("ERRO: Falha ao conectar no banco de dados!")
    end
    return db
end

-- ── HTTP para o site ──────────────────────────────────────────────────
local function postToSite(endpoint, data, cb)
    fetchRemote(MTA_STORE_SITE_URL .. endpoint, {
        method = "POST",
        postData = toJSON(data),
        headers = {
            ["Content-Type"] = "application/json",
            ["X-API-Token"]  = MTA_STORE_TOKEN,
        },
        connectTimeout = 10000,
        readTimeout    = 10000,
    }, function(response, errno)
        local errCode = type(errno) == "table" and (errno.code or 0) or (tonumber(errno) or 0)
        if errCode ~= 0 then
            if MTA_STORE_DEBUG then
                log("ERRO POST " .. endpoint .. " errno=" .. tostring(errCode))
            end
            return
        end
        if cb then cb(fromJSON(response)) end
    end)
end

-- ── Busca dados do jogador no banco e envia ao site ───────────────────
local function fetchAndSync(player)
    if not isElement(player) then return end
    local conn = connectDB()
    if not conn then
        if MTA_STORE_DEBUG then log("fetchAndSync: sem conexao DB") end
        return
    end

    local serial = getPlayerSerial(player)

    -- Busca dados principais do jogador
    dbQuery(function(qh)
        if not isElement(player) then return end
        local row = dbPoll(qh, 0)
        if not row or not row[1] then
            if MTA_STORE_DEBUG then log("fetchAndSync: jogador nao encontrado serial=" .. serial) end
            return
        end
        local r = row[1]

        -- Busca veiculos
        dbQuery(function(qhV)
            if not isElement(player) then return end
            local veiculos = dbPoll(qhV, 0) or {}

            -- Busca inventario
            dbQuery(function(qhI)
                if not isElement(player) then return end
                local inventario = dbPoll(qhI, 0) or {}

                -- Envia tudo ao site
                postToSite("/api/player/sync", {
                    serial        = serial,
                    online        = true,
                    updatedAt     = os.time(),
                    nome          = (r.nome or "") .. " " .. (r.sobrenome or ""),
                    idade         = r.idade         or 0,
                    sexo          = r.sexo          or "M",
                    skin          = r.skin          or 0,
                    horasJogadas  = r.horas_jogadas or 0,
                    dinheiro      = r.dinheiro      or 0,
                    banco         = r.banco         or 0,
                    faccao        = r.faccao        or "Nenhuma",
                    cargo         = r.cargo         or "Membro",
                    emprego       = r.emprego       or "Desempregado",
                    nivel         = r.nivel         or 1,
                    xp            = r.xp            or 0,
                    vida          = r.vida          or 100,
                    colete        = r.colete        or 0,
                    cnh           = (r.cnh == 1 or r.cnh == true),
                    rg            = (r.rg  == 1 or r.rg  == true),
                    porteArma     = (r.porte_arma == 1 or r.porte_arma == true),
                    veiculos      = veiculos,
                    inventario    = inventario,
                }, nil)

            end, conn, "SELECT item, quantidade FROM inventario WHERE serial = ? LIMIT 50", serial)
        end, conn, "SELECT modelo, placa, cor, garagem FROM veiculos WHERE serial = ? LIMIT 20", serial)

    end, conn,
        "SELECT dinheiro, banco, faccao, cargo, emprego, nivel, xp, vida, colete, nome, sobrenome, idade, sexo, skin, cnh, rg, porte_arma, horas_jogadas FROM jogadores WHERE serial = ? LIMIT 1",
        serial
    )
end

-- ── Gera token de login e envia link ao jogador ───────────────────────
local function sendToken(player)
    local serial = getPlayerSerial(player)
    local token  = hash("sha256", serial .. tostring(os.time()) .. tostring(math.random(1, 999999))):sub(1, 32)
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

-- ── Registra jogador no site automaticamente ──────────────────────
local function registerPlayer(player)
    if not isElement(player) then return end
    local serial = getPlayerSerial(player)
    local acc = getPlayerAccount(player)
    local accName = acc and not isGuestAccount(acc) and getAccountName(acc) or nil
    local playerName = getPlayerName(player) or "jogador"

    postToSite("/api/player/register-by-serial", {
        serial = serial,
        account = accName,
        playerName = playerName,
    }, nil)
end

-- ── Eventos ───────────────────────────────────────────────────────────
addEventHandler("onPlayerLogin", root, function()
    local player = source
    setTimer(function()
        if isElement(player) then
            registerPlayer(player)
            fetchAndSync(player)
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
        if isElement(player) then fetchAndSync(player) end
    end, 1000, 1)
end)

-- Sync periodico de todos os jogadores online
setTimer(function()
    for _, player in ipairs(getElementsByType("player")) do
        local p = player
        setTimer(function()
            if isElement(p) then fetchAndSync(p) end
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

-- Conecta ao iniciar (MySQL opcional — loja funciona sem ele)
addEventHandler("onResourceStart", resourceRoot, function()
    local conn = connectDB()
    if not conn then
        log("AVISO: MySQL nao conectado. Sync de dados do jogador desativado.")
        log("A loja (scan/activate/health) continua funcionando normalmente.")
    end
    log("Sync iniciado. /loja | /store | /shop")
end)

addEventHandler("onResourceStop", resourceRoot, function()
    if db then dbClose(db); db = nil end
    log("Sync parado.")
end)

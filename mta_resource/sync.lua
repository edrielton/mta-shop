--[[
    MTA STORE - sync.lua
    =====================================================================
    Coleta dados dos jogadores da tabela `jogadores` via oxmysql
    e envia para o site em tempo real.

    Fluxo:
      1. Jogador entra no servidor
      2. Gera token de auto-login e envia link no chat
      3. Sincroniza dados a cada SYNC_INTERVAL segundos
      4. Atualiza dados quando jogador sai (estado offline)
    =====================================================================
--]]

local SYNC_INTERVAL = 30  -- segundos entre cada sync automático
local SITE_URL      = MTA_STORE_SITE_URL    -- definido no config.lua
local API_TOKEN     = MTA_STORE_TOKEN        -- mesmo token do config.lua

-- ======================================================================
-- UTILITÁRIOS
-- ======================================================================

local function debugLog(msg)
    if MTA_STORE_DEBUG then
        outputDebugString("[MTA-Store Sync] " .. tostring(msg), 3)
    end
end

local function sendToSite(endpoint, payload, callback)
    local url  = SITE_URL .. endpoint
    local body = toJSON(payload)

    local headers = {
        ["Content-Type"] = "application/json",
        ["X-API-Token"]  = API_TOKEN,
    }

    fetchRemote(url, {
        method          = "POST",
        postData        = body,
        headers         = headers,
        connectTimeout  = 10000,
        readTimeout     = 10000,
    }, function(response, errno)
        if errno ~= 0 then
            debugLog("Erro ao enviar para " .. endpoint .. " (errno: " .. errno .. ")")
            return
        end
        local data = fromJSON(response)
        if callback then callback(data) end
    end)
end

-- ======================================================================
-- BUSCA DADOS DO JOGADOR NO BANCO DO RP
-- ======================================================================

local function fetchPlayerData(serial, callback)
    exports["oxmysql"]:single(
        [[
            SELECT
                dinheiro, banco, faccao, cargo, emprego,
                nivel, xp, vida, colete,
                nome, sobrenome, idade, sexo,
                skin, cnh, rg, porte_arma,
                horas_jogadas, criado_em
            FROM jogadores
            WHERE serial = ?
            LIMIT 1
        ]],
        { serial },
        function(row)
            if row then
                callback(row)
            else
                debugLog("Jogador não encontrado no banco: " .. serial)
                callback(nil)
            end
        end
    )
end

-- Busca veículos do jogador
local function fetchPlayerVehicles(serial, callback)
    exports["oxmysql"]:query(
        "SELECT modelo, placa, cor, garagem FROM veiculos WHERE serial = ? LIMIT 20",
        { serial },
        function(rows)
            callback(rows or {})
        end
    )
end

-- Busca inventário do jogador
local function fetchPlayerInventory(serial, callback)
    exports["oxmysql"]:query(
        "SELECT item, quantidade FROM inventario WHERE serial = ? LIMIT 50",
        { serial },
        function(rows)
            callback(rows or {})
        end
    )
end

-- Busca propriedades do jogador
local function fetchPlayerProperties(serial, callback)
    exports["oxmysql"]:query(
        "SELECT nome, endereco, tipo FROM propriedades WHERE serial = ? LIMIT 10",
        { serial },
        function(rows)
            callback(rows or {})
        end
    )
end

-- ======================================================================
-- GERAR TOKEN DE AUTO-LOGIN
-- ======================================================================

local function generateToken(serial)
    -- Token: hash baseado no serial + timestamp + número aleatório
    local raw   = serial .. tostring(os.time()) .. tostring(math.random(100000, 999999))
    local token = hash("sha256", raw):sub(1, 32) -- 32 chars
    return token
end

local function sendAutoLoginToken(player)
    local serial = getPlayerSerial(player)
    local token  = generateToken(serial)

    -- Envia token para o site (site guarda serial ↔ token)
    sendToSite("/api/player/token", {
        serial    = serial,
        token     = token,
        expiresIn = 300, -- token válido por 5 minutos
    }, function(data)
        if data and data.success then
            local link = SITE_URL .. "/entrar?t=" .. token
            outputChatBox(
                "#00FF7F[MTA Store] #FFFFFFAcesse sua conta na loja:\n" ..
                "#00BFFF" .. link,
                player, 255, 255, 255, true
            )
            debugLog("Token enviado para " .. getPlayerName(player))
        end
    end)
end

-- ======================================================================
-- SINCRONIZAR DADOS DO JOGADOR COM O SITE
-- ======================================================================

local function syncPlayer(player)
    local serial = getPlayerSerial(player)

    -- Busca dados principais
    fetchPlayerData(serial, function(row)
        if not row then return end

        -- Busca dados adicionais em paralelo
        local vehicles   = {}
        local inventory  = {}
        local properties = {}
        local pending    = 3

        local function checkDone()
            pending = pending - 1
            if pending > 0 then return end

            -- Monta payload completo
            local payload = {
                serial     = serial,
                online     = true,
                updatedAt  = os.time(),

                -- Personagem
                nome       = (row.nome or "") .. " " .. (row.sobrenome or ""),
                idade      = row.idade or 0,
                sexo       = row.sexo or "M",
                skin       = row.skin or 0,
                horasJogadas = row.horas_jogadas or 0,

                -- Economia
                dinheiro   = row.dinheiro or 0,
                banco      = row.banco or 0,

                -- RP
                faccao     = row.faccao or "Nenhuma",
                cargo      = row.cargo or "Membro",
                emprego    = row.emprego or "Desempregado",
                nivel      = row.nivel or 1,
                xp         = row.xp or 0,

                -- Status
                vida       = row.vida or 100,
                colete     = row.colete or 0,

                -- Documentos
                cnh        = row.cnh == 1 or row.cnh == true,
                rg         = row.rg == 1 or row.rg == true,
                porteArma  = row.porte_arma == 1 or row.porte_arma == true,

                -- Listas
                veiculos   = vehicles,
                inventario = inventory,
                propriedades = properties,
            }

            sendToSite("/api/player/sync", payload, function(res)
                if res and res.success then
                    debugLog("Sync OK: " .. getPlayerName(player))
                end
            end)
        end

        fetchPlayerVehicles(serial, function(v)
            vehicles = v
            checkDone()
        end)

        fetchPlayerInventory(serial, function(i)
            inventory = i
            checkDone()
        end)

        fetchPlayerProperties(serial, function(p)
            properties = p
            checkDone()
        end)
    end)
end

-- Marca jogador como offline no site
local function syncPlayerOffline(serial)
    sendToSite("/api/player/sync", {
        serial  = serial,
        online  = false,
        updatedAt = os.time(),
    }, nil)
end

-- ======================================================================
-- EVENTOS
-- ======================================================================

-- Jogador logou no servidor
addEventHandler("onPlayerLogin", root, function(_, account)
    local player = source
    setTimer(function()
        -- Pequeno delay para garantir que os dados do RP já carregaram
        syncPlayer(player)
        sendAutoLoginToken(player)
    end, 2000, 1)
end)

-- Jogador saiu do servidor
addEventHandler("onPlayerQuit", root, function()
    local serial = getPlayerSerial(source)
    syncPlayerOffline(serial)
end)

-- Jogador morreu / levou dano (atualiza vida/colete)
addEventHandler("onPlayerWasted", root, function()
    local player = source
    setTimer(function()
        syncPlayer(player)
    end, 1000, 1)
end)

-- ======================================================================
-- SYNC AUTOMÁTICO A CADA N SEGUNDOS (para todos online)
-- ======================================================================

setTimer(function()
    local players = getElementsByType("player")
    if #players == 0 then return end

    debugLog("Sync automático: " .. #players .. " jogador(es)")

    for _, player in ipairs(players) do
        -- Pequeno delay entre cada jogador para não sobrecarregar
        setTimer(function()
            if isElement(player) then
                syncPlayer(player)
            end
        end, math.random(500, 3000), 1)
    end
end, SYNC_INTERVAL * 1000, 0)

-- ======================================================================
-- COMANDO: jogador pede o link manualmente
-- ======================================================================

addCommandHandler("loja", function(player)
    sendAutoLoginToken(player)
end)

addCommandHandler("store", function(player)
    sendAutoLoginToken(player)
end)

outputServerLog("[MTA-Store] Sync de jogadores iniciado. Intervalo: " .. SYNC_INTERVAL .. "s")

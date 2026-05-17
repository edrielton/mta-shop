--[[
    MTA STORE - server.lua  v1.1
    =====================================================================
    MELHORIAS v1.1:
      - Sistema de idempotência (evita processar transação duas vezes)
      - Retry automático da fila offline (tenta a cada 30s para jogadores online)
      - Limite de retentativas na fila (maxRetries)
      - Estatísticas básicas exportadas
      - Log de ativações mais detalhado
    =====================================================================
--]]

local QUEUE_FILE    = "queue.json"
local MAX_RETRIES   = 3        -- Tentativas máximas por item na fila
local RETRY_DELAY   = 30       -- Segundos entre tentativas automáticas

-- Controle de idempotência (transações já processadas)
local processedTransactions = {}

-- ======================================================================
-- UTILITÁRIOS
-- ======================================================================

local function debugLog(msg)
    if MTA_STORE_DEBUG then
        outputDebugString("[MTA-Store] " .. tostring(msg), 3)
    end
end

local function colorMsg(player, msg)
    outputChatBox(msg, player, 255, 255, 255, true)
end

local function hexToBin(hex)
    return (hex:gsub("..", function(h)
        return string.char(tonumber(h, 16))
    end))
end

-- ======================================================================
-- HMAC-SHA256
-- ======================================================================

function computeHmacSha256(key, message)
    local blockSize = 64

    if #key > blockSize then
        key = hexToBin(hash("sha256", key))
    end

    while #key < blockSize do
        key = key .. "\0"
    end

    local ipad, opad = "", ""
    for i = 1, blockSize do
        local b = string.byte(key, i)
        ipad = ipad .. string.char(bitXor(b, 0x36))
        opad = opad .. string.char(bitXor(b, 0x5C))
    end

    local innerHex = hash("sha256", ipad .. message)
    local innerBin = hexToBin(innerHex)
    local outerHex = hash("sha256", opad .. innerBin)

    return outerHex
end

-- ======================================================================
-- IDEMPOTÊNCIA
-- ======================================================================

function isTransactionProcessed(transactionId)
    return processedTransactions[transactionId] == true
end

function markTransactionProcessed(transactionId)
    processedTransactions[transactionId] = true
    debugLog("Transação marcada como processada: " .. tostring(transactionId))
end

-- ======================================================================
-- FILA DE ATIVAÇÕES OFFLINE
-- ======================================================================

local function loadQueue()
    local file = fileOpen(QUEUE_FILE, true)
    if not file then return {} end
    local size = fileGetSize(file)
    if size == 0 then
        fileClose(file)
        return {}
    end
    local content = fileRead(file, size)
    fileClose(file)
    local data = fromJSON(content)
    return (type(data) == "table") and data or {}
end

local function saveQueue(queue)
    local file = fileOpen(QUEUE_FILE, false)
    if not file then
        file = fileCreate(QUEUE_FILE)
    end
    if not file then
        outputDebugString("[MTA-Store] ERRO: não foi possível salvar a fila offline.", 1)
        return
    end
    fileSetPos(file, 0)
    fileWrite(file, toJSON(queue, true))
    fileClose(file)
end

function queueActivation(serial, account, command, params, transactionId)
    local queue = loadQueue()
    local key = serial or account
    if not key then return false end
    if not queue[key] then queue[key] = {} end
    table.insert(queue[key], {
        command       = command,
        params        = params,
        transactionId = transactionId,
        account       = account,
        serial        = serial,
        queuedAt      = os.time(),
        retries       = 0,
    })
    saveQueue(queue)
    debugLog("Item na fila para " .. key .. ": " .. command)
    return true
end

-- Recebe queue já carregado para preservar modificações em memória (ex: retries)
local function removeFromQueue(queue, key, processedIds)
    if not queue[key] then return end
    local remaining = {}
    for _, entry in ipairs(queue[key]) do
        local processed = false
        for _, id in ipairs(processedIds) do
            if entry.transactionId == id then
                processed = true
                break
            end
        end
        if not processed then
            table.insert(remaining, entry)
        end
    end
    queue[key] = remaining
    saveQueue(queue)
end

-- ======================================================================
-- HANDLERS DOS COMANDOS
-- ======================================================================

local commandHandlers = {}

-- giveVip: { days = N }
commandHandlers["giveVip"] = function(player, params)
    local days = tonumber(params and params.days) or 30
    local currentVip = getElementData(player, "vip:days") or 0
    setElementData(player, "vip:active", true)
    setElementData(player, "vip:days", currentVip + days)
    setElementData(player, "vip:expires", os.time() + (days * 86400))
    triggerClientEvent(player, "mta_store:vipGranted", player, days)
    colorMsg(player, MTA_STORE_MSGS.vip_granted)
    debugLog("VIP dado a " .. getPlayerName(player) .. " por " .. days .. " dias")
    return true, "VIP ativado por " .. days .. " dias"
end

-- giveCar: { carId = N, tuning = bool }
commandHandlers["giveCar"] = function(player, params)
    local carId  = tonumber(params and params.carId) or 411
    local tuning = (params and params.tuning == true)
    local x, y, z = getElementPosition(player)

    local veh = createVehicle(carId, x + 3, y, z)
    if not veh then
        return false, "Falha ao criar veículo (modelo " .. carId .. ")"
    end

    setElementData(veh, "owner:serial", getPlayerSerial(player))
    setElementData(veh, "owner:name",   getPlayerName(player))

    if tuning then
        setVehicleEngineState(veh, true)
        addVehicleUpgrade(veh, 1010)
    end

    warpPedIntoVehicle(player, veh)
    colorMsg(player, MTA_STORE_MSGS.car_granted)
    debugLog("Veículo " .. carId .. " dado a " .. getPlayerName(player))
    return true, "Veículo " .. carId .. " criado"
end

-- giveVehicle: alias para giveCar com parâmetro diferente
commandHandlers["giveVehicle"] = function(player, params)
    local vehicleId = tonumber(params and params.vehicleId) or 400
    local x, y, z  = getElementPosition(player)

    local veh = createVehicle(vehicleId, x + 3, y, z)
    if not veh then
        return false, "Falha ao criar veículo (modelo " .. vehicleId .. ")"
    end

    setElementData(veh, "owner:serial", getPlayerSerial(player))
    setElementData(veh, "owner:name",   getPlayerName(player))
    warpPedIntoVehicle(player, veh)
    colorMsg(player, MTA_STORE_MSGS.car_granted)
    debugLog("Veículo " .. vehicleId .. " dado a " .. getPlayerName(player))
    return true, "Veículo " .. vehicleId .. " criado"
end

-- giveCoins: { amount = N }
commandHandlers["giveCoins"] = function(player, params)
    local amount = tonumber(params and params.amount) or 0
    if amount <= 0 then
        return false, "Quantidade de moedas inválida"
    end

    local current = getElementData(player, "coins") or 0
    setElementData(player, "coins", current + amount)
    triggerClientEvent(player, "mta_store:coinsGranted", player, amount)

    local msg = MTA_STORE_MSGS.coins_granted:format(amount)
    colorMsg(player, msg)
    debugLog("+" .. amount .. " moedas para " .. getPlayerName(player))
    return true, amount .. " moedas adicionadas"
end

-- giveSkin: { skinId = N }
commandHandlers["giveSkin"] = function(player, params)
    local skinId = tonumber(params and params.skinId) or 0
    setElementModel(player, skinId)
    setElementData(player, "skin:id", skinId)
    colorMsg(player, MTA_STORE_MSGS.skin_granted)
    debugLog("Skin " .. skinId .. " aplicada a " .. getPlayerName(player))
    return true, "Skin " .. skinId .. " aplicada"
end

-- giveWeaponKit: { kit = "starter" | "premium" }
commandHandlers["giveWeaponKit"] = function(player, params)
    local kit = (params and params.kit) or "starter"
    local kits = {
        starter = {
            { id = 22, ammo = 200 },
            { id = 27, ammo = 100 },
            { id = 31, ammo = 200 },
        },
        premium = {
            { id = 22, ammo = 500 },
            { id = 31, ammo = 500 },
            { id = 34, ammo = 200 },
            { id = 35, ammo = 10  },
            { id = 16, ammo = 10  },
        },
    }

    local weapons = kits[kit]
    if not weapons then
        return false, "Kit '" .. kit .. "' não encontrado"
    end

    for _, w in ipairs(weapons) do
        giveWeapon(player, w.id, w.ammo, false)
    end

    colorMsg(player, MTA_STORE_MSGS.weapon_granted)
    debugLog("Kit '" .. kit .. "' dado a " .. getPlayerName(player))
    return true, "Kit " .. kit .. " entregue"
end

-- giveProperty: { propertyId = N }
commandHandlers["giveProperty"] = function(player, params)
    local propertyId = tonumber(params and params.propertyId) or 0
    setElementData(player, "property:" .. propertyId .. ":owner", getPlayerSerial(player))
    triggerClientEvent(player, "mta_store:propertyGranted", player, propertyId)
    colorMsg(player, "#00FF7F[MTA Store] #FFFFFFPropriedade #" .. propertyId .. " agora é sua!")
    debugLog("Propriedade " .. propertyId .. " dada a " .. getPlayerName(player))
    return true, "Propriedade " .. propertyId .. " atribuída"
end

-- ======================================================================
-- FUNÇÃO PRINCIPAL DE ATIVAÇÃO (exportada para activate.lua)
-- ======================================================================

function executeProductCommand(command, serial, account, params, transactionId)
    local player = nil

    if serial and serial ~= "" then
        player = getPlayerBySerial(serial)
    end

    if not player and account and account ~= "" then
        for _, p in ipairs(getElementsByType("player")) do
            local acc = getPlayerAccount(p)
            if acc and getAccountName(acc) == account then
                player = p
                break
            end
        end
    end

    local handler = commandHandlers[command]
    if not handler then
        debugLog("Comando desconhecido: " .. tostring(command))
        return false, "Comando desconhecido: " .. tostring(command)
    end

    if player then
        local ok, msg = handler(player, params)
        if ok then
            outputServerLog("[MTA-Store] Ativação OK: " .. command .. " para " .. getPlayerName(player))
        else
            outputServerLog("[MTA-Store] Falha: " .. command .. " -> " .. tostring(msg))
        end
        return ok, msg
    else
        local queued = queueActivation(serial, account, command, params, transactionId)
        if queued then
            return true, "offline_queued"
        end
        return false, "Falha ao colocar na fila"
    end
end

-- ======================================================================
-- LOGIN: aplica itens pendentes + retry de falhas anteriores
-- ======================================================================

addEventHandler("onPlayerLogin", root, function(_, account)
    local player  = source
    local serial  = getPlayerSerial(player)
    local accName = account and getAccountName(account) or nil

    local queue = loadQueue()
    local keys  = { serial }
    if accName then table.insert(keys, accName) end

    for _, key in ipairs(keys) do
        local entries = queue[key]
        if entries and #entries > 0 then
            colorMsg(player, MTA_STORE_MSGS.offline_queue)
            local processed = {}

            for _, entry in ipairs(entries) do
                -- Pula itens que excederam o limite de retentativas
                if (entry.retries or 0) >= MAX_RETRIES then
                    outputServerLog("[MTA-Store] Item descartado após " .. MAX_RETRIES .. " tentativas: " .. tostring(entry.transactionId))
                    table.insert(processed, entry.transactionId) -- Remove da fila
                else
                    local handler = commandHandlers[entry.command]
                    if handler then
                        local ok, msg = handler(player, entry.params)
                        debugLog("Fila: " .. entry.command .. " -> " .. tostring(ok))
                        if ok then
                            markTransactionProcessed(entry.transactionId)
                            table.insert(processed, entry.transactionId)
                        else
                            -- Incrementa contador de tentativas
                            entry.retries = (entry.retries or 0) + 1
                        end
                    end
                end
            end

            if #processed > 0 then
                removeFromQueue(queue, key, processed)
            else
                -- Salva retries incrementados mesmo sem itens removidos
                saveQueue(queue)
            end
        end
    end
end)

-- ======================================================================
-- RETRY AUTOMÁTICO: tenta ativar itens da fila para jogadores online
-- A cada RETRY_DELAY segundos, verifica se algum jogador online tem
-- itens pendentes na fila (ex: erro transitório anterior)
-- ======================================================================

local function retryQueueForOnlinePlayers()
    local queue = loadQueue()
    if not next(queue) then return end -- fila vazia

    for _, player in ipairs(getElementsByType("player")) do
        local serial  = getPlayerSerial(player)
        local acc     = getPlayerAccount(player)
        local accName = acc and getAccountName(acc) or nil

        local keys = { serial }
        if accName then table.insert(keys, accName) end

        for _, key in ipairs(keys) do
            local entries = queue[key]
            if entries and #entries > 0 then
                local processed = {}

                for _, entry in ipairs(entries) do
                    if (entry.retries or 0) < MAX_RETRIES then
                        local handler = commandHandlers[entry.command]
                        if handler and not isTransactionProcessed(entry.transactionId) then
                            local ok, _ = handler(player, entry.params)
                            if ok then
                                markTransactionProcessed(entry.transactionId)
                                table.insert(processed, entry.transactionId)
                                debugLog("Retry OK: " .. entry.command .. " para " .. getPlayerName(player))
                            else
                                entry.retries = (entry.retries or 0) + 1
                            end
                        end
                    end
                end

                if #processed > 0 then
                    removeFromQueue(queue, key, processed)
                end
            end
        end
    end

    -- Salva incrementos de retry que não foram removidos
    saveQueue(queue)
end

setTimer(retryQueueForOnlinePlayers, RETRY_DELAY * 1000, 0)

-- ======================================================================
-- INICIALIZAÇÃO
-- ======================================================================

addEventHandler("onResourceStart", resourceRoot, function()
    outputServerLog("[MTA-Store] v1.1 iniciado.")
    outputServerLog("[MTA-Store] Endpoints: /mta_store/activate (POST) | /mta_store/health (GET)")

    if not fileExists(QUEUE_FILE) then
        local f = fileCreate(QUEUE_FILE)
        if f then
            fileWrite(f, "{}")
            fileClose(f)
        end
    end
end)

addEventHandler("onResourceStop", resourceRoot, function()
    outputServerLog("[MTA-Store] Resource parado. Fila preservada em " .. QUEUE_FILE)
end)

-- ======================================================================
-- COMANDO: /storesync — escaneia todos os mods e envia pro site
-- Pode ser usado por admins no chat ou no console do servidor
-- ======================================================================

local function runSync(player)
    local isConsole = (player == nil)
    local name      = isConsole and "Console" or getPlayerName(player)

    -- Só admin pode usar (no chat)
    if not isConsole and not isPlayerAdmin(player) then
        outputChatBox("#FF4444[MTA Store] #FFFFFFVocê não tem permissão para usar este comando.", player, 255, 255, 255, true)
        return
    end

    local msg = "[MTA-Store] Sincronizando mods com o site... (solicitado por " .. name .. ")"
    outputServerLog(msg)
    if not isConsole then
        outputChatBox("#00FF7F[MTA Store] #FFFFFFEscaneando todos os mods, aguarde...", player, 255, 255, 255, true)
    end

    -- Coleta todos os resources
    local resources = {}
    local detected  = {}

    for _, resource in ipairs(getResources()) do
        local rName  = getResourceName(resource)
        local rState = getResourceState(resource)
        local rDesc  = getResourceInfo(resource, "description") or ""
        local rType  = getResourceInfo(resource, "type") or "misc"

        local item = {
            name        = rName,
            state       = rState,
            description = rDesc,
            type        = rType,
            sellable    = {},
        }

        -- Detecta sistemas vendáveis (rodando apenas)
        if rState == "running" then
            local lName = rName:lower()
            local lDesc = rDesc:lower()

            -- VIP
            if lName:find("vip") or lDesc:find("vip") or lName:find("rank") or lName:find("premium") or lName:find("doador") then
                item.classified = "vip"

                -- Tenta pegar tiers exportados
                local tierFns = {"getVipTiers","getPlanos","getVipLevels","getTiers","getNiveis","getVipPlans","getVipList"}
                local foundTiers = false

                for _, fn in ipairs(tierFns) do
                    local ok, result = pcall(function() return exports[rName][fn]() end)
                    if ok and type(result) == "table" then
                        for k, v in pairs(result) do
                            local tName = type(v) == "table" and (v.name or v.nome or v.label or tostring(k)) or tostring(v)
                            local tId   = type(v) == "table" and (v.id or v.nivel or k) or k
                            table.insert(item.sellable, {
                                suggestedName   = tName,
                                suggestedDesc   = tName .. " — acesso especial no servidor.",
                                category        = "vip",
                                mtaCommand      = "giveVip",
                                mtaParams       = { tier = tostring(tId), days = 30, resource = rName },
                                autoDetected    = true,
                            })
                            foundTiers = true
                        end
                        if foundTiers then break end
                    end
                end

                -- Detecta por keywords no nome
                if not foundTiers then
                    local keywords = {
                        {p="gold",    n="VIP Gold"},    {p="ouro",    n="VIP Ouro"},
                        {p="prata",   n="VIP Prata"},   {p="silver",  n="VIP Silver"},
                        {p="bronze",  n="VIP Bronze"},  {p="diamond", n="VIP Diamond"},
                        {p="diamante",n="VIP Diamante"},{p="platina", n="VIP Platina"},
                        {p="vip1",    n="VIP Nível 1"}, {p="vip2",    n="VIP Nível 2"},
                        {p="vip3",    n="VIP Nível 3"},
                    }
                    for _, kw in ipairs(keywords) do
                        if lName:find(kw.p) then
                            table.insert(item.sellable, {
                                suggestedName  = kw.n,
                                suggestedDesc  = kw.n .. " — acesso especial no servidor.",
                                category       = "vip",
                                mtaCommand     = "giveVip",
                                mtaParams      = { tier = kw.p, days = 30, resource = rName },
                                autoDetected   = true,
                            })
                        end
                    end
                end

                -- Fallback: VIP genérico
                if #item.sellable == 0 then
                    table.insert(item.sellable, {
                        suggestedName  = "VIP — " .. rName,
                        suggestedDesc  = "Acesso VIP do servidor.",
                        category       = "vip",
                        mtaCommand     = "giveVip",
                        mtaParams      = { resource = rName, days = 30 },
                        autoDetected   = false,
                    })
                end

            -- VEÍCULOS
            elseif lName:find("vehicle") or lName:find("veiculo") or lName:find("carro") or lName:find("garage") then
                item.classified = "vehicle"
                local vFns = {"getVehicleList","getVeiculos","getCars","getVehicles","getCarros"}
                local found = false
                for _, fn in ipairs(vFns) do
                    local ok, result = pcall(function() return exports[rName][fn]() end)
                    if ok and type(result) == "table" then
                        for _, v in ipairs(result) do
                            table.insert(item.sellable, {
                                suggestedName  = v.name or v.nome or ("Veículo " .. tostring(v.model or "")),
                                suggestedDesc  = "Entregue no seu spawn.",
                                category       = "vehicle",
                                mtaCommand     = "giveVehicle",
                                mtaParams      = { vehicleId = v.model or v.modelo, resource = rName },
                                autoDetected   = true,
                            })
                        end
                        found = true; break
                    end
                end
                if not found then
                    table.insert(item.sellable, {
                        suggestedName  = "Veículo — " .. rName,
                        suggestedDesc  = "Veículo exclusivo do servidor.",
                        category       = "vehicle",
                        mtaCommand     = "giveVehicle",
                        mtaParams      = { resource = rName },
                        autoDetected   = false,
                    })
                end

            -- MOEDAS
            elseif lName:find("coin") or lName:find("moeda") or lName:find("economy") or lName:find("economia") then
                item.classified = "coins"
                for _, amount in ipairs({1000, 5000, 15000}) do
                    table.insert(item.sellable, {
                        suggestedName  = amount .. " Moedas",
                        suggestedDesc  = "Pacote de " .. amount .. " moedas.",
                        category       = "coins",
                        mtaCommand     = "giveCoins",
                        mtaParams      = { amount = amount, resource = rName },
                        autoDetected   = false,
                    })
                end

            -- ARMAS
            elseif lName:find("weapon") or lName:find("arma") or lName:find("kit") then
                item.classified = "weapon"
                for _, kit in ipairs({"starter","premium"}) do
                    table.insert(item.sellable, {
                        suggestedName  = "Kit " .. kit:sub(1,1):upper() .. kit:sub(2),
                        suggestedDesc  = "Kit de armas " .. kit .. ".",
                        category       = "item",
                        mtaCommand     = "giveWeaponKit",
                        mtaParams      = { kit = kit, resource = rName },
                        autoDetected   = false,
                    })
                end
            end

            -- Adiciona itens detectados na lista global
            for _, s in ipairs(item.sellable) do
                s.resourceName = rName
                table.insert(detected, s)
            end
        end

        table.insert(resources, item)
    end

    -- Envia para o site
    local payload = {
        source    = "command",
        trigger   = name,
        total     = #resources,
        detected  = detected,
        resources = resources,
        scannedAt = os.time(),
    }

    local url  = MTA_STORE_SITE_URL .. "/api/admin/mta-command-sync"
    local body = toJSON(payload)

    fetchRemote(url, {
        method         = "POST",
        postData       = body,
        headers        = {
            ["Content-Type"] = "application/json",
            ["X-API-Token"]  = MTA_STORE_TOKEN,
        },
        connectTimeout = 15000,
        readTimeout    = 15000,
    }, function(response, errno)
        if errno ~= 0 then
            outputServerLog("[MTA-Store] Erro ao enviar sync (errno: " .. errno .. ")")
            if not isConsole then
                outputChatBox("#FF4444[MTA Store] #FFFFFFErro ao conectar com o site.", player, 255, 255, 255, true)
            end
            return
        end

        local data = fromJSON(response)
        local created = data and data.created or 0
        local skipped = data and data.skipped or 0
        local total   = data and data.total   or #detected

        local resultMsg = string.format(
            "[MTA-Store] Sync concluído! %d mods escaneados, %d item(ns) detectado(s), %d produto(s) criado(s), %d já existiam.",
            #resources, total, created, skipped
        )

        outputServerLog(resultMsg)

        if not isConsole then
            outputChatBox(
                string.format(
                    "#00FF7F[MTA Store] #FFFFFFSync concluído! #00BFFF%d #FFFFFFitem(ns) detectado(s), #00BFFF%d #FFFFFFproduto(s) criado(s) na loja.",
                    total, created
                ),
                player, 255, 255, 255, true
            )
        end
    end)
end

-- Comando no chat (admin)
addCommandHandler("storesync", function(player)
    runSync(player)
end)

-- Comando no console do servidor
addCommandHandler("storesync", function(player)
    if not player then runSync(nil) end
end, false, false)

outputServerLog("[MTA-Store] Comando disponível: storesync (chat: /storesync | console: storesync)")

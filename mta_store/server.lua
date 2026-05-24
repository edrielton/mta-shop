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

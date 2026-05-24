--[[
    MTA STORE - server.lua
    Lógica principal: ativações, fila offline, retry automático.
    Comando: /storesync (admin) | storesync (console)
--]]

local QUEUE_FILE  = "queue.json"
local MAX_RETRIES = 3
local RETRY_DELAY = 30 -- segundos

local processedTx = {} -- idempotência

-- ── Utilidades ─────────────────────────────────────────────────────────

local function log(msg)
    outputServerLog("[MTA-Store] " .. tostring(msg))
end

local function dbg(msg)
    if MTA_STORE_DEBUG then
        outputDebugString("[MTA-Store] " .. tostring(msg), 3)
    end
end

local function chat(player, msg)
    outputChatBox(MTA_STORE_MSG_PREFIX .. msg, player, 255, 255, 255, true)
end

-- ── Fila offline ───────────────────────────────────────────────────────

local function queueLoad()
    if not fileExists(QUEUE_FILE) then return {} end
    local f = fileOpen(QUEUE_FILE, true)
    if not f then return {} end
    local size = fileGetSize(f)
    if size == 0 then fileClose(f); return {} end
    local raw = fileRead(f, size)
    fileClose(f)
    local t = fromJSON(raw)
    return type(t) == "table" and t or {}
end

local function queueSave(q)
    local f = fileExists(QUEUE_FILE) and fileOpen(QUEUE_FILE, false) or fileCreate(QUEUE_FILE)
    if not f then return end
    fileSetPos(f, 0)
    fileWrite(f, toJSON(q))
    fileClose(f)
end

local function queueAdd(key, entry)
    local q = queueLoad()
    if not q[key] then q[key] = {} end
    table.insert(q[key], entry)
    queueSave(q)
end

local function queueRemove(q, key, ids)
    if not q[key] then return end
    local keep = {}
    for _, e in ipairs(q[key]) do
        local remove = false
        for _, id in ipairs(ids) do
            if e.transactionId == id then remove = true; break end
        end
        if not remove then table.insert(keep, e) end
    end
    q[key] = keep
end

-- ── Handlers de ativação ───────────────────────────────────────────────

local handlers = {}

handlers["giveVip"] = function(player, params)
    local days = tonumber(params and params.days) or 30
    local cur  = getElementData(player, "vip:days") or 0
    setElementData(player, "vip:active",  true)
    setElementData(player, "vip:days",    cur + days)
    setElementData(player, "vip:expires", os.time() + days * 86400)
    if params and params.tier then
        setElementData(player, "vip:tier", params.tier)
    end
    triggerClientEvent(player, "mta_store:vipGranted", player, days)
    chat(player, "Seu VIP foi ativado! Aproveite!")
    return true, "VIP ativado"
end

handlers["giveCoins"] = function(player, params)
    local amount = tonumber(params and params.amount) or 0
    if amount <= 0 then return false, "Quantidade inválida" end
    local cur = getElementData(player, "coins") or 0
    setElementData(player, "coins", cur + amount)
    triggerClientEvent(player, "mta_store:coinsGranted", player, amount)
    chat(player, "+" .. amount .. " moedas adicionadas!")
    return true, amount .. " moedas"
end

handlers["giveVehicle"] = function(player, params)
    local id = tonumber(params and params.vehicleId) or 411
    local x, y, z = getElementPosition(player)
    local veh = createVehicle(id, x + 3, y, z)
    if not veh then return false, "Falha ao criar veículo" end
    setElementData(veh, "owner", getPlayerSerial(player))
    warpPedIntoVehicle(player, veh)
    chat(player, "Veículo entregue!")
    return true, "Veículo " .. id
end

handlers["giveWeaponKit"] = function(player, params)
    local kit = (params and params.kit) or "starter"
    local kits = {
        starter = {{22,200},{27,100},{31,200}},
        premium = {{22,500},{31,500},{34,200},{35,10},{16,10}},
    }
    local weapons = kits[kit]
    if not weapons then return false, "Kit inexistente: " .. kit end
    for _, w in ipairs(weapons) do giveWeapon(player, w[1], w[2]) end
    chat(player, "Kit de armas entregue!")
    return true, "Kit " .. kit
end

handlers["giveSkin"] = function(player, params)
    local skinId = tonumber(params and params.skinId) or 0
    setElementModel(player, skinId)
    chat(player, "Skin aplicada!")
    return true, "Skin " .. skinId
end

-- ── Ativação principal ─────────────────────────────────────────────────

function executeProductCommand(command, serial, account, params, transactionId)
    -- Procura jogador online
    local player = nil
    if serial and serial ~= "" then
        player = getPlayerBySerial(serial)
    end
    if not player and account and account ~= "" then
        for _, p in ipairs(getElementsByType("player")) do
            local acc = getPlayerAccount(p)
            if acc and getAccountName(acc) == account then
                player = p; break
            end
        end
    end

    local handler = handlers[command]
    if not handler then
        return false, "Comando desconhecido: " .. tostring(command)
    end

    if player then
        local ok, msg = handler(player, params)
        if ok then
            log("Ativação OK: " .. command .. " → " .. getPlayerName(player))
        end
        return ok, msg
    else
        -- Offline: coloca na fila
        local key = serial ~= "" and serial or account
        queueAdd(key, {
            command       = command,
            params        = params,
            transactionId = transactionId,
            serial        = serial,
            account       = account,
            retries       = 0,
            queuedAt      = os.time(),
        })
        log("Offline — item na fila para: " .. tostring(key))
        return true, "offline_queued"
    end
end

function isTransactionProcessed(txId)
    return processedTx[txId] == true
end

function markTransactionProcessed(txId)
    processedTx[txId] = true
end

-- ── Login: processa fila ───────────────────────────────────────────────

addEventHandler("onPlayerLogin", root, function(_, account)
    local player  = source
    local serial  = getPlayerSerial(player)
    local accName = account and getAccountName(account) or nil

    local q    = queueLoad()
    local keys = {serial}
    if accName then table.insert(keys, accName) end

    for _, key in ipairs(keys) do
        local entries = q[key]
        if entries and #entries > 0 then
            chat(player, "Você tem itens pendentes sendo ativados...")
            local done = {}

            for _, entry in ipairs(entries) do
                if (entry.retries or 0) >= MAX_RETRIES then
                    log("Item descartado (max retries): " .. tostring(entry.transactionId))
                    table.insert(done, entry.transactionId)
                else
                    local h = handlers[entry.command]
                    if h then
                        local ok = h(player, entry.params)
                        if ok then
                            markTransactionProcessed(entry.transactionId)
                            table.insert(done, entry.transactionId)
                        else
                            entry.retries = (entry.retries or 0) + 1
                        end
                    end
                end
            end

            if #done > 0 then
                queueRemove(q, key, done)
                queueSave(q)
            end
        end
    end
end)

-- ── Retry automático ───────────────────────────────────────────────────

setTimer(function()
    local q = queueLoad()
    if not next(q) then return end

    for _, player in ipairs(getElementsByType("player")) do
        local serial  = getPlayerSerial(player)
        local acc     = getPlayerAccount(player)
        local accName = acc and not isGuestAccount(acc) and getAccountName(acc) or nil

        local keys = {serial}
        if accName then table.insert(keys, accName) end

        for _, key in ipairs(keys) do
            if q[key] and #q[key] > 0 then
                local done = {}
                for _, entry in ipairs(q[key]) do
                    if (entry.retries or 0) < MAX_RETRIES and not isTransactionProcessed(entry.transactionId) then
                        local h = handlers[entry.command]
                        if h then
                            local ok = h(player, entry.params)
                            if ok then
                                markTransactionProcessed(entry.transactionId)
                                table.insert(done, entry.transactionId)
                            else
                                entry.retries = (entry.retries or 0) + 1
                            end
                        end
                    end
                end
                if #done > 0 then
                    queueRemove(q, key, done)
                end
            end
        end
    end
    queueSave(q)
end, RETRY_DELAY * 1000, 0)

-- ── /storesync — escaneia mods e envia pro site ────────────────────────

local function isPlayerAdmin(player)
    local acc = getPlayerAccount(player)
    if not acc or isGuestAccount(acc) then return false end
    local group = aclGetGroup("Admin")
    if not group then return false end
    return isObjectInACLGroup("user." .. getAccountName(acc), group)
end

local function doSync(player)
    local isConsole   = (player == nil)
    local triggerName = isConsole and "Console" or getPlayerName(player)

    if not isConsole and not isPlayerAdmin(player) then
        chat(player, "Sem permissão. Apenas admins podem usar /storesync.")
        return
    end

    log("Sync iniciado por: " .. triggerName)
    if not isConsole then
        chat(player, "Escaneando todos os mods... aguarde.")
    end

    local resources = {}
    local detected  = {}

    for _, resource in ipairs(getResources()) do
        local rName  = getResourceName(resource)
        local rState = getResourceState(resource)
        local rDesc  = getResourceInfo(resource, "description") or ""
        local lName  = rName:lower()
        local lDesc  = rDesc:lower()

        local entry = {
            name        = rName,
            state       = rState,
            description = rDesc,
            classified  = "other",
            sellable    = {},
        }

        if rState == "running" then

            -- VIP
            if lName:find("vip") or lName:find("rank") or lName:find("premium")
            or lName:find("doador") or lDesc:find("vip") then
                entry.classified = "vip"

                -- Tenta exportações
                local fns = {"getVipTiers","getPlanos","getVipLevels","getTiers","getNiveis","getVipPlans","getVipList"}
                local found = false
                for _, fn in ipairs(fns) do
                    local ok, r = pcall(function() return exports[rName][fn]() end)
                    if ok and type(r) == "table" then
                        for k, v in pairs(r) do
                            local n = type(v)=="table" and (v.name or v.nome or v.label or tostring(k)) or tostring(v)
                            local id = type(v)=="table" and (v.id or v.nivel or k) or k
                            local it = {suggestedName=n, suggestedDesc=n.." — benefícios exclusivos.", category="vip", mtaCommand="giveVip", mtaParams={tier=tostring(id),days=30,resource=rName}, autoDetected=true, resourceName=rName}
                            table.insert(entry.sellable, it)
                            table.insert(detected, it)
                            found = true
                        end
                        if found then break end
                    end
                end

                -- Keywords
                if not found then
                    for _, kw in ipairs({
                        {p="gold",n="VIP Gold"},{p="ouro",n="VIP Ouro"},{p="prata",n="VIP Prata"},
                        {p="silver",n="VIP Silver"},{p="bronze",n="VIP Bronze"},{p="diamond",n="VIP Diamond"},
                        {p="diamante",n="VIP Diamante"},{p="platina",n="VIP Platina"},{p="vip1",n="VIP Nível 1"},
                        {p="vip2",n="VIP Nível 2"},{p="vip3",n="VIP Nível 3"},
                    }) do
                        if lName:find(kw.p) or lDesc:find(kw.p) then
                            local it = {suggestedName=kw.n, suggestedDesc=kw.n.." — benefícios exclusivos.", category="vip", mtaCommand="giveVip", mtaParams={tier=kw.p,days=30,resource=rName}, autoDetected=true, resourceName=rName}
                            table.insert(entry.sellable, it)
                            table.insert(detected, it)
                            found = true
                        end
                    end
                end

                if not found then
                    local it = {suggestedName="VIP — "..rName, suggestedDesc="Acesso VIP.", category="vip", mtaCommand="giveVip", mtaParams={resource=rName,days=30}, autoDetected=false, resourceName=rName}
                    table.insert(entry.sellable, it)
                    table.insert(detected, it)
                end

            -- VEÍCULOS
            elseif lName:find("vehicle") or lName:find("veiculo") or lName:find("carro") or lName:find("garage") then
                entry.classified = "vehicle"
                local fns = {"getVehicleList","getVeiculos","getCars","getVehicles","getCarros"}
                local found = false
                for _, fn in ipairs(fns) do
                    local ok, r = pcall(function() return exports[rName][fn]() end)
                    if ok and type(r) == "table" then
                        for _, v in ipairs(r) do
                            local it = {suggestedName=v.name or v.nome or "Veículo", suggestedDesc="Entregue no spawn.", category="vehicle", mtaCommand="giveVehicle", mtaParams={vehicleId=v.model or v.modelo,resource=rName}, autoDetected=true, resourceName=rName}
                            table.insert(entry.sellable, it)
                            table.insert(detected, it)
                        end
                        found = true; break
                    end
                end
                if not found then
                    local it = {suggestedName="Veículo — "..rName, suggestedDesc="Veículo exclusivo.", category="vehicle", mtaCommand="giveVehicle", mtaParams={resource=rName}, autoDetected=false, resourceName=rName}
                    table.insert(entry.sellable, it)
                    table.insert(detected, it)
                end

            -- MOEDAS
            elseif lName:find("coin") or lName:find("moeda") or lName:find("econom") or lName:find("cash") then
                entry.classified = "coins"
                for _, amt in ipairs({1000,5000,15000}) do
                    local it = {suggestedName=amt.." Moedas", suggestedDesc="Pacote de "..amt.." moedas.", category="coins", mtaCommand="giveCoins", mtaParams={amount=amt,resource=rName}, autoDetected=false, resourceName=rName}
                    table.insert(entry.sellable, it)
                    table.insert(detected, it)
                end

            -- ARMAS
            elseif lName:find("weapon") or lName:find("arma") then
                entry.classified = "weapon"
                for _, kit in ipairs({"starter","premium"}) do
                    local it = {suggestedName="Kit "..(kit:sub(1,1):upper()..kit:sub(2)), suggestedDesc="Kit de armas "..kit..".", category="item", mtaCommand="giveWeaponKit", mtaParams={kit=kit,resource=rName}, autoDetected=false, resourceName=rName}
                    table.insert(entry.sellable, it)
                    table.insert(detected, it)
                end
            end
        end

        table.insert(resources, entry)
    end

    -- Envia para o site
    fetchRemote(
        MTA_STORE_SITE_URL .. "/api/admin/mta-command-sync",
        {
            method         = "POST",
            postData       = toJSON({source="command", trigger=triggerName, total=#resources, detected=detected, resources=resources, scannedAt=os.time()}),
            headers        = {["Content-Type"]="application/json", ["X-API-Token"]=MTA_STORE_TOKEN},
            connectTimeout = 15000,
            readTimeout    = 15000,
        },
        function(response, errno)
            if errno ~= 0 then
                log("ERRO no sync — errno: "..errno.." | Verifique MTA_STORE_SITE_URL no config.lua")
                if not isConsole then
                    chat(player, "Erro ao conectar com o site (errno "..errno.."). Verifique o config.lua.")
                end
                return
            end
            local data = fromJSON(response) or {}
            local msg  = string.format("Sync OK — %d detectados, %d criados, %d já existiam.", data.total or #detected, data.created or 0, data.skipped or 0)
            log(msg)
            if not isConsole then
                chat(player, "Sync concluído! "..(data.created or 0).." produto(s) criado(s) na loja.")
            end
        end
    )
end

-- Registra comando UMA vez (funciona no chat e no console)
addCommandHandler("storesync", doSync, false, false)

-- ── Inicialização ──────────────────────────────────────────────────────

addEventHandler("onResourceStart", resourceRoot, function()
    if not fileExists(QUEUE_FILE) then
        local f = fileCreate(QUEUE_FILE)
        if f then fileWrite(f, "{}"); fileClose(f) end
    end
    log("Iniciado! Comandos: /loja | /store | /shop | /storesync (admin)")
    log("Endpoints: /mta_store/activate | /mta_store/health | /mta_store/scan")
end)

addEventHandler("onResourceStop", resourceRoot, function()
    log("Resource parado.")
end)

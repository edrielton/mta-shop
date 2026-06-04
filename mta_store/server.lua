-- MTA STORE - server.lua
-- Logica principal: ativacoes, fila offline, retry, exports

local QUEUE_FILE  = "queue.json"
local MAX_RETRIES = 3
local RETRY_DELAY = 30
local processedTx = {}

local function log(msg) outputServerLog("[MTA-Store] " .. tostring(msg)) end
local function dbg(msg) if MTA_STORE_DEBUG then outputDebugString("[MTA-Store] " .. tostring(msg), 3) end end
local function chat(player, msg) outputChatBox(MTA_STORE_MSG_PREFIX .. msg, player, 255, 255, 255, true) end

-- Fila offline
local function queueLoad()
    if not fileExists(QUEUE_FILE) then return {} end
    local f = fileOpen(QUEUE_FILE, true)
    if not f then return {} end
    local sz = fileGetSize(f)
    if sz == 0 then fileClose(f); return {} end
    local raw = fileRead(f, sz)
    fileClose(f)
    local t = fromJSON(raw)
    return type(t) == "table" and t or {}
end

local function queueSave(q)
    local f = fileExists(QUEUE_FILE) and fileOpen(QUEUE_FILE, false) or fileCreate(QUEUE_FILE)
    if not f then return end
    fileSetPos(f, 0); fileWrite(f, toJSON(q)); fileClose(f)
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
        for _, id in ipairs(ids) do if e.transactionId == id then remove = true; break end end
        if not remove then table.insert(keep, e) end
    end
    q[key] = keep
end

-- Handlers de ativacao
local handlers = {}

handlers["giveVip"] = function(player, params)
    local days = tonumber(params and params.days) or 30
    local cur  = getElementData(player, "vip:days") or 0
    setElementData(player, "vip:active",  true)
    setElementData(player, "vip:days",    cur + days)
    setElementData(player, "vip:expires", os.time() + days * 86400)
    if params and params.tier then setElementData(player, "vip:tier", params.tier) end
    triggerClientEvent(player, "mta_store:vipGranted", player, days)
    chat(player, "Seu VIP foi ativado!")
    return true, "VIP ativado"
end

handlers["giveCoins"] = function(player, params)
    local amount = tonumber(params and params.amount) or 0
    if amount <= 0 then return false, "Quantidade invalida" end
    local cur = getElementData(player, "coins") or 0
    setElementData(player, "coins", cur + amount)
    triggerClientEvent(player, "mta_store:coinsGranted", player, amount)
    chat(player, "+" .. amount .. " moedas!")
    return true, amount .. " moedas"
end

handlers["giveVehicle"] = function(player, params)
    local id = tonumber(params and params.vehicleId) or 411
    local x, y, z = getElementPosition(player)
    local veh = createVehicle(id, x + 3, y, z)
    if not veh then return false, "Falha ao criar veiculo" end
    setElementData(veh, "owner", getPlayerSerial(player))
    warpPedIntoVehicle(player, veh)
    chat(player, "Veiculo entregue!")
    return true, "Veiculo " .. id
end

handlers["giveWeaponKit"] = function(player, params)
    local kit = (params and params.kit) or "starter"
    local kits = {
        starter = {{22,200},{27,100},{31,200}},
        premium = {{22,500},{31,500},{34,200},{35,10},{16,10}},
    }
    local weapons = kits[kit]
    if not weapons then return false, "Kit invalido: " .. kit end
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

-- Funcao principal de ativacao
function executeProductCommand(command, serial, account, params, transactionId)
    local player = nil
    if serial and serial ~= "" then player = getPlayerBySerial(serial) end
    if not player and account and account ~= "" then
        for _, p in ipairs(getElementsByType("player")) do
            local acc = getPlayerAccount(p)
            if acc and getAccountName(acc) == account then player = p; break end
        end
    end
    local handler = handlers[command]
    if not handler then return false, "Comando desconhecido: " .. tostring(command) end
    if player then
        local ok, msg = handler(player, params)
        if ok then log("OK: " .. command .. " para " .. getPlayerName(player)) end
        return ok, msg
    else
        local key = (serial and serial ~= "") and serial or account
        queueAdd(key, {command=command, params=params, transactionId=transactionId, serial=serial, account=account, retries=0, queuedAt=os.time()})
        log("Offline: fila para " .. tostring(key))
        return true, "offline_queued"
    end
end

function isTransactionProcessed(txId) return processedTx[txId] == true end
function markTransactionProcessed(txId) processedTx[txId] = true end

-- EXPORTS para outros resources (ex: mta-admin-panel)
function getSiteUrl() return MTA_STORE_SITE_URL end
function getToken()   return MTA_STORE_TOKEN end
function getStoreConfig() return {siteUrl=MTA_STORE_SITE_URL, token=MTA_STORE_TOKEN} end

-- Login: processa fila
addEventHandler("onPlayerLogin", root, function(_, account)
    local player  = source
    local serial  = getPlayerSerial(player)
    local accName = account and getAccountName(account) or nil
    local q       = queueLoad()
    local keys    = {serial}
    if accName then table.insert(keys, accName) end
    for _, key in ipairs(keys) do
        local entries = q[key]
        if entries and #entries > 0 then
            chat(player, "Voce tem itens pendentes sendo ativados...")
            local done = {}
            for _, entry in ipairs(entries) do
                if (entry.retries or 0) >= MAX_RETRIES then
                    table.insert(done, entry.transactionId)
                else
                    local h = handlers[entry.command]
                    if h then
                        local ok = h(player, entry.params)
                        if ok then markTransactionProcessed(entry.transactionId); table.insert(done, entry.transactionId)
                        else entry.retries = (entry.retries or 0) + 1 end
                    end
                end
            end
            if #done > 0 then queueRemove(q, key, done); queueSave(q) end
        end
    end
end)

-- Retry automatico
setTimer(function()
    local q = queueLoad()
    if not next(q) then return end
    for _, player in ipairs(getElementsByType("player")) do
        local serial  = getPlayerSerial(player)
        local acc     = getPlayerAccount(player)
        local accName = acc and not isGuestAccount(acc) and getAccountName(acc) or nil
        local keys    = {serial}
        if accName then table.insert(keys, accName) end
        for _, key in ipairs(keys) do
            if q[key] and #q[key] > 0 then
                local done = {}
                for _, entry in ipairs(q[key]) do
                    if (entry.retries or 0) < MAX_RETRIES and not isTransactionProcessed(entry.transactionId) then
                        local h = handlers[entry.command]
                        if h then
                            local ok = h(player, entry.params)
                            if ok then markTransactionProcessed(entry.transactionId); table.insert(done, entry.transactionId)
                            else entry.retries = (entry.retries or 0) + 1 end
                        end
                    end
                end
                if #done > 0 then queueRemove(q, key, done) end
            end
        end
    end
    queueSave(q)
end, RETRY_DELAY * 1000, 0)

-- Admin check
local function isPlayerAdmin(player)
    local acc = getPlayerAccount(player)
    if not acc or isGuestAccount(acc) then return false end
    local group = aclGetGroup("Admin")
    if not group then return false end
    return isObjectInACLGroup("user." .. getAccountName(acc), group)
end

-- /storesync
local function doSync(player)
    local isConsole   = (player == nil)
    local triggerName = isConsole and "Console" or getPlayerName(player)
    if not isConsole and not isPlayerAdmin(player) then
        chat(player, "Sem permissao para usar /storesync.")
        return
    end
    log("Sync por: " .. triggerName)
    if not isConsole then chat(player, "Escaneando mods... aguarde.") end

    local resources = {}
    local detected  = {}

    for _, resource in ipairs(getResources()) do
        local rName  = getResourceName(resource)
        local rState = getResourceState(resource)
        local rDesc  = getResourceInfo(resource, "description") or ""
        local lName  = rName:lower()
        local entry  = {name=rName, state=rState, description=rDesc, classified="other", sellable={}}

        if rState == "running" then
            if lName:find("vip") or lName:find("rank") or lName:find("premium") or lName:find("doador") or rDesc:lower():find("vip") then
                entry.classified = "vip"
                local found = false
                for _, kw in ipairs({{p="gold",n="VIP Gold"},{p="ouro",n="VIP Ouro"},{p="prata",n="VIP Prata"},{p="silver",n="VIP Silver"},{p="bronze",n="VIP Bronze"},{p="vip1",n="VIP Nivel 1"},{p="vip2",n="VIP Nivel 2"},{p="vip3",n="VIP Nivel 3"}}) do
                    if lName:find(kw.p) or rDesc:lower():find(kw.p) then
                        local it = {suggestedName=kw.n, suggestedDesc=kw.n.." - beneficios exclusivos.", category="vip", mtaCommand="giveVip", mtaParams={tier=kw.p,days=30,resource=rName}, autoDetected=true, resourceName=rName}
                        table.insert(entry.sellable, it); table.insert(detected, it); found = true
                    end
                end
                if not found then
                    local it = {suggestedName="VIP - "..rName, suggestedDesc="Acesso VIP.", category="vip", mtaCommand="giveVip", mtaParams={resource=rName,days=30}, autoDetected=false, resourceName=rName}
                    table.insert(entry.sellable, it); table.insert(detected, it)
                end
            elseif lName:find("vehicle") or lName:find("veiculo") or lName:find("carro") then
                entry.classified = "vehicle"
                local it = {suggestedName="Veiculo - "..rName, suggestedDesc="Veiculo exclusivo.", category="vehicle", mtaCommand="giveVehicle", mtaParams={resource=rName}, autoDetected=false, resourceName=rName}
                table.insert(entry.sellable, it); table.insert(detected, it)
            elseif lName:find("coin") or lName:find("moeda") or lName:find("econom") then
                entry.classified = "coins"
                for _, amt in ipairs({1000,5000,15000}) do
                    local it = {suggestedName=amt.." Moedas", suggestedDesc="Pacote de "..amt.." moedas.", category="coins", mtaCommand="giveCoins", mtaParams={amount=amt,resource=rName}, autoDetected=false, resourceName=rName}
                    table.insert(entry.sellable, it); table.insert(detected, it)
                end
            elseif lName:find("weapon") or lName:find("arma") then
                entry.classified = "weapon"
                for _, kit in ipairs({"starter","premium"}) do
                    local it = {suggestedName="Kit "..kit, suggestedDesc="Kit de armas "..kit..".", category="item", mtaCommand="giveWeaponKit", mtaParams={kit=kit,resource=rName}, autoDetected=false, resourceName=rName}
                    table.insert(entry.sellable, it); table.insert(detected, it)
                end
            end
        end
        table.insert(resources, entry)
    end

    fetchRemote(MTA_STORE_SITE_URL .. "/api/mta/sync", {
        method="POST",
        postData=toJSON({source="command",trigger=triggerName,total=#resources,detected=detected,resources=resources,scannedAt=os.time()}),
        headers={["Content-Type"]="application/json",["X-API-Token"]=MTA_STORE_TOKEN},
        connectTimeout=15000, readTimeout=15000,
    }, function(response, errno)
        if errno ~= 0 then
            log("ERRO sync errno: " .. errno)
            if not isConsole then chat(player, "Erro ao conectar (errno " .. errno .. ").") end
            return
        end
        local data = fromJSON(response) or {}
        log("Sync OK: " .. (data.created or 0) .. " criados")
        if not isConsole then chat(player, "Sync OK! " .. (data.created or 0) .. " produto(s) criado(s).") end
    end)
end

addCommandHandler("storesync", doSync, false, false)

addEventHandler("onResourceStart", resourceRoot, function()
    if not fileExists(QUEUE_FILE) then
        local f = fileCreate(QUEUE_FILE)
        if f then fileWrite(f, "{}"); fileClose(f) end
    end
    log("v2.0 Iniciado! URL: " .. tostring(MTA_STORE_SITE_URL))
    log("Comandos: /loja | /store | /shop | /storesync")
    log("Endpoints: /mta_store/activate | /mta_store/health | /mta_store/scan")
end)

addEventHandler("onResourceStop", resourceRoot, function() log("Resource parado.") end)

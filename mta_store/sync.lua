-- MTA STORE - sync.lua
-- Sincroniza dados dos jogadores com o site via oxmysql
-- Comandos: /loja | /store | /shop

local SYNC_INTERVAL = 30

local function log(msg) outputServerLog("[MTA-Store Sync] " .. tostring(msg)) end
local function chat(player, msg) outputChatBox(MTA_STORE_MSG_PREFIX .. msg, player, 255, 255, 255, true) end

local function postToSite(endpoint, data, cb)
    fetchRemote(MTA_STORE_SITE_URL .. endpoint, {
        method="POST",
        postData=toJSON(data),
        headers={["Content-Type"]="application/json", ["X-API-Token"]=MTA_STORE_TOKEN},
        connectTimeout=10000, readTimeout=10000,
    }, function(response, errno)
        if errno ~= 0 then
            if MTA_STORE_DEBUG then outputDebugString("[MTA-Store] errno " .. errno .. " em " .. endpoint, 2) end
            return
        end
        if cb then cb(fromJSON(response)) end
    end)
end

local function fetchAndSync(player)
    local serial = getPlayerSerial(player)
    exports["oxmysql"]:single(
        "SELECT dinheiro, banco, faccao, cargo, emprego, nivel, xp, vida, colete, nome, sobrenome, idade, sexo, skin, cnh, rg, porte_arma, horas_jogadas FROM jogadores WHERE serial = ? LIMIT 1",
        {serial},
        function(row)
            if not isElement(player) or not row then return end
            exports["oxmysql"]:query("SELECT modelo, placa, cor, garagem FROM veiculos WHERE serial = ? LIMIT 20", {serial}, function(veiculos)
                if not isElement(player) then return end
                exports["oxmysql"]:query("SELECT item, quantidade FROM inventario WHERE serial = ? LIMIT 50", {serial}, function(inventario)
                    if not isElement(player) then return end
                    postToSite("/api/player/sync", {
                        serial=serial, online=true, updatedAt=os.time(),
                        nome=(row.nome or "") .. " " .. (row.sobrenome or ""),
                        idade=row.idade or 0, sexo=row.sexo or "M", skin=row.skin or 0,
                        horasJogadas=row.horas_jogadas or 0,
                        dinheiro=row.dinheiro or 0, banco=row.banco or 0,
                        faccao=row.faccao or "Nenhuma", cargo=row.cargo or "Membro",
                        emprego=row.emprego or "Desempregado",
                        nivel=row.nivel or 1, xp=row.xp or 0,
                        vida=row.vida or 100, colete=row.colete or 0,
                        cnh=(row.cnh == 1 or row.cnh == true),
                        rg=(row.rg == 1 or row.rg == true),
                        porteArma=(row.porte_arma == 1 or row.porte_arma == true),
                        veiculos=veiculos or {}, inventario=inventario or {},
                    }, nil)
                end)
            end)
        end
    )
end

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

addEventHandler("onPlayerLogin", root, function()
    local player = source
    setTimer(function()
        if isElement(player) then fetchAndSync(player); sendToken(player) end
    end, 2000, 1)
end)

addEventHandler("onPlayerQuit", root, function()
    postToSite("/api/player/sync", {serial=getPlayerSerial(source), online=false, updatedAt=os.time()}, nil)
end)

addEventHandler("onPlayerWasted", root, function()
    local player = source
    setTimer(function() if isElement(player) then fetchAndSync(player) end end, 1000, 1)
end)

setTimer(function()
    for _, player in ipairs(getElementsByType("player")) do
        local p = player
        setTimer(function() if isElement(p) then fetchAndSync(p) end end, math.random(500, 3000), 1)
    end
end, SYNC_INTERVAL * 1000, 0)

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

log("Sync iniciado. /loja | /store | /shop")

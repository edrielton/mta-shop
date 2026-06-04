-- MTA Store Admin Panel - server.lua
-- Comandos: /adminpanel | /ap | /painel

local SITE_URL = ""
local TOKEN    = ""

addEventHandler("onResourceStart", resourceRoot, function()
    -- Le config via exports do mta_store
    local storeResource = getResourceFromName("mta_store")
    if storeResource and getResourceState(storeResource) == "running" then
        SITE_URL = exports["mta_store"]:getSiteUrl() or ""
        TOKEN    = exports["mta_store"]:getToken()   or ""
        outputServerLog("[MTA-Admin] Config carregada do mta_store. URL: " .. SITE_URL)
    else
        outputServerLog("[MTA-Admin] AVISO: mta_store nao esta rodando!")
        outputServerLog("[MTA-Admin] Inicie o mta_store antes do mta-admin-panel.")
    end

    outputServerLog("[MTA-Admin] Pronto. Comandos: /adminpanel | /ap | /painel")
end)

local function isAdmin(player)
    local acc = getPlayerAccount(player)
    if not acc or isGuestAccount(acc) then return false end
    local name = "user." .. getAccountName(acc)
    local g1 = aclGetGroup("Admin")
    if g1 and isObjectInACLGroup(name, g1) then return true end
    local g2 = aclGetGroup("SuperModerators")
    if g2 and isObjectInACLGroup(name, g2) then return true end
    return false
end

local function openPanel(player)
    if not isAdmin(player) then
        outputChatBox("[Admin Panel] Sem permissao.", player, 255, 80, 80)
        return
    end
    if SITE_URL == "" then
        -- Tenta carregar novamente caso mta_store tenha iniciado depois
        local storeResource = getResourceFromName("mta_store")
        if storeResource and getResourceState(storeResource) == "running" then
            SITE_URL = exports["mta_store"]:getSiteUrl() or ""
            TOKEN    = exports["mta_store"]:getToken()   or ""
        end
    end
    if SITE_URL == "" then
        outputChatBox("[Admin Panel] mta_store nao esta rodando. Inicie-o primeiro.", player, 255, 80, 80)
        return
    end
    outputServerLog("[MTA-Admin] " .. getPlayerName(player) .. " abriu o painel.")
    triggerClientEvent(player, "mta_admin:show", player, SITE_URL, TOKEN)
end

addCommandHandler("adminpanel", function(p) openPanel(p) end, false, false)
addCommandHandler("ap",         function(p) openPanel(p) end, false, false)
addCommandHandler("painel",     function(p) openPanel(p) end, false, false)

addEvent("mta_admin:apiCall", true)
addEventHandler("mta_admin:apiCall", root, function(callId, method, endpoint, bodyJson)
    local player = client
    if not isAdmin(player) then return end

    fetchRemote(SITE_URL .. endpoint, {
        method=method,
        postData=bodyJson or "",
        headers={["Content-Type"]="application/json", ["X-API-Token"]=TOKEN},
        connectTimeout=15000, readTimeout=15000,
    }, function(response, errno)
        if isElement(player) then
            triggerClientEvent(player, "mta_admin:apiResponse", player, callId, errno == 0, response or "")
        end
    end)
end)

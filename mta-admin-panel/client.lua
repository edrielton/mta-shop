-- MTA Store Admin Panel - client.lua v1.3 (MTA 1.6+)

local guiBrowser = nil
local theBrowser = nil
local isOpen     = false
local usedMode   = ""

addEvent("mta_admin:show",        true)
addEvent("mta_admin:apiResponse", true)

addEventHandler("mta_admin:show", root, function(url, token)
    if isOpen then
        closePanel()
        return
    end

    local sw, sh = guiGetScreenSize()

    usedMode = "guiCreateBrowser"
    guiBrowser = guiCreateBrowser(0, 0, sw, sh, false, false, false)
    if not guiBrowser then
        outputChatBox("[Admin Panel] Erro ao criar guiBrowser.", 255, 80, 80)
        return
    end

    guiSetAlpha(guiBrowser, 255)
    guiBringToFront(guiBrowser)

    -- o objeto navegador real
    theBrowser = guiGetBrowser(guiBrowser)

    addEventHandler("onClientBrowserCreated", theBrowser, function()
        local url = getResourceURL(getThisResource()) .. "panel.html"
        outputChatBox("[Admin Panel] Loading browser URL: " .. tostring(url), 255, 220, 50)
        loadBrowserURL(theBrowser, url)

        setTimer(function()
            if guiBrowser and isElement(guiBrowser) then
                guiSetAlpha(guiBrowser, 255)
                guiBringToFront(guiBrowser)
            end
        end, 200, 1)
    end)

    addEventHandler("onClientBrowserDocumentReady", theBrowser, function()
        executeBrowserJavascript(theBrowser, string.format(
            'window.MTA_CONFIG={siteUrl:"%s",token:"%s"};if(window.onMtaConfig)window.onMtaConfig();',
            url, token
        ))
        outputChatBox("[Admin Panel] panel.html carregado.", 160, 220, 255)
    end)

    addEventHandler("onClientBrowserMessage", theBrowser, function(msg)
        local ok, data = pcall(fromJSON, msg)
        if not ok or type(data) ~= "table" then return end
        if data.type == "close" then
            closePanel()
        elseif data.type == "api" then
            triggerServerEvent("mta_admin:apiCall", localPlayer,
                data.id, data.method, data.endpoint, data.body)
        end
    end)

    showCursor(true)
    isOpen = true
    outputChatBox("[Admin Panel] Painel aberto (" .. usedMode .. "). ESC para fechar.", 100, 255, 100)
end)

addEventHandler("mta_admin:apiResponse", root, function(callId, success, response)
    if not (theBrowser and isElement(theBrowser)) then return end
    executeBrowserJavascript(theBrowser, string.format(
        'if(window.onApiResponse)window.onApiResponse(%q,%s,%q);',
        tostring(callId), success and "true" or "false", tostring(response or "")
    ))
end)

function closePanel()
    if theBrowser and isElement(theBrowser) then destroyElement(theBrowser) end
    if guiBrowser and isElement(guiBrowser) then destroyElement(guiBrowser) end
    guiBrowser = nil
    theBrowser = nil
    showCursor(false)
    isOpen = false
    outputChatBox("[Admin Panel] Fechado.", 180, 180, 180)
end

bindKey("escape", "down", function()
    if isOpen then closePanel() end
end)

outputDebugString("[MTA-Admin] v1.3 carregado. /adminpanel | /ap | /painel")

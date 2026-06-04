-- MTA Store Admin Panel - client.lua v1.4 (MTA 1.6+)

local guiBrowser = nil
local theBrowser = nil
local isOpen     = false
local usedMode   = ""

addEvent("mta_admin:show",        true)
addEvent("mta_admin:apiResponse", true)

addEventHandler("mta_admin:show", root, function(url, token)
    local ok, err = pcall(function()
        outputChatBox("[Admin Panel] mta_admin:show recebido. url=" .. tostring(url), 255, 255, 0)
        if isOpen then
            closePanel()
            return
        end

        local sw, sh = guiGetScreenSize()

        usedMode = "guiCreateBrowser"
        guiBrowser = guiCreateBrowser(0, 0, sw, sh, false, false, false)
        outputChatBox("[Admin Panel] guiCreateBrowser: sw=" .. tostring(sw) .. " sh=" .. tostring(sh) .. " isElement=" .. tostring(isElement(guiBrowser)), 255, 220, 50)
        if not guiBrowser or not isElement(guiBrowser) then
            outputChatBox("[Admin Panel] Erro ao criar guiBrowser.", 255, 80, 80)
            return
        end

        theBrowser = guiGetBrowser(guiBrowser)
        outputChatBox("[Admin Panel] theBrowser isElement=" .. tostring(isElement(theBrowser)), 255, 220, 50)

        guiSetAlpha(guiBrowser, 255)
        guiSetVisible(guiBrowser, true)
        guiBringToFront(guiBrowser)

        -- loadBrowserURL nessa MTA só aceita http/https.
        -- Então precisamos usar a URL HTTP do arquivo dentro do resource.
        -- Aqui assumimos que exista getResourceName e que o server esteja servido via HTTP (ex.: /resources/<nome>/...).
        -- Se isso não estiver ativo no seu servidor, a alternativa é montar um endpoint HTTP no Node.
        local localUrl = ""

        if getResourceURL then
            localUrl = getResourceURL(getThisResource()) .. "panel.html"
        else
            -- fallback: tenta um caminho comum de servidor web do MTA
            -- (ajuste se seu host servir arquivos de resource por outra rota)
            local resName = getResourceName(getThisResource())
            -- endpoint HTTP servido pelo backend Node (server/mtaAdminStatic.ts)
            -- O MTA carrega via internet, então usamos o SITE_URL que já veio no evento.
            localUrl = tostring(url) .. "/mta-admin-panel/panel.html"

        end
        outputChatBox("[Admin Panel] url local=" .. tostring(localUrl), 255, 220, 50)

        local function tryLoad(attempt)
            if not (theBrowser and isElement(theBrowser)) then
                outputChatBox("[Admin Panel] tryLoad #" .. tostring(attempt) .. " ignored (invalid browser)", 255, 80, 80)
                return
            end
            outputChatBox("[Admin Panel] tryLoadBrowserURL #" .. tostring(attempt), 140, 220, 50)
            local ok2, err2 = pcall(loadBrowserURL, theBrowser, localUrl)
            if not ok2 then
                outputChatBox("[Admin Panel] loadBrowserURL error: " .. tostring(err2), 255, 80, 80)
            end
            guiSetVisible(guiBrowser, true)
            guiBringToFront(guiBrowser)
            guiSetAlpha(guiBrowser, 255)
        end

        -- carregamento com repetição
        outputChatBox("[Admin Panel] starting tryLoad...")
        tryLoad(1)
        setTimer(function() tryLoad(2) end, 300, 1)
        setTimer(function() tryLoad(3) end, 600, 1)

        -- eventos
        addEventHandler("onClientBrowserCreated", theBrowser, function()
            outputChatBox("[Admin Panel] browser created -> load: " .. tostring(localUrl), 255, 220, 50)
            -- teste: tenta buscar via fetchRemote (se existir no MTA) para validar status/corpo
            if fetchRemote then
                fetchRemote(localUrl, {
                    method = "GET",
                    connectTimeout = 5000,
                    readTimeout = 5000,
                }, function(resp, errno)
                    outputChatBox("[Admin Panel] fetchRemote HTML test errno=" .. tostring(errno) .. ", len=" .. tostring(resp and #resp or 0), 255, 200, 50)
                end)
            end
            loadBrowserURL(theBrowser, localUrl)
        end)


        local ready = false
        addEventHandler("onClientBrowserDocumentReady", theBrowser, function()
            ready = true
            executeBrowserJavascript(theBrowser, string.format(
                'window.MTA_CONFIG={siteUrl:"%s",token:"%s"};if(window.onMtaConfig)window.onMtaConfig();',
                url, token
            ))
            outputChatBox("[Admin Panel] panel.html carregado.", 160, 220, 255)
        end)

        -- Debug: se não disparar documentReady em 8s, avisa
        setTimer(function()
            if not ready and isElement(theBrowser) then
            outputChatBox("[Admin Panel] ERRO: documentReady não disparou. Tentando forçar reload + alertar. URL=" .. tostring(localUrl), 255, 80, 80)
            if isElement(guiBrowser) then
                guiBringToFront(guiBrowser)
                guiSetVisible(guiBrowser, true)
            end
            -- tenta novo load mais 1 vez
            setTimer(function()
                if theBrowser and isElement(theBrowser) and localUrl and localUrl ~= "" then
                    loadBrowserURL(theBrowser, localUrl)
                end
            end, 500, 1)

            end
        end, 8000, 1)


        addEventHandler("onClientBrowserMessage", theBrowser, function(msg)
            local ok3, data = pcall(fromJSON, msg)
            if not ok3 or type(data) ~= "table" then return end
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

    if not ok then
        outputChatBox("[Admin Panel] Lua handler error: " .. tostring(err), 255, 80, 80)
    end
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

outputDebugString("[MTA-Admin] v1.4 carregado. /adminpanel | /ap | /painel")


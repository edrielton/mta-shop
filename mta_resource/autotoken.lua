--[[
    MTA STORE - autotoken.lua
    =====================================================================
    Endpoint HTTP que o site chama para validar o token de auto-login.
    GET /mta_store/autotoken?token=XXX

    Retorna os dados básicos do jogador para o site confirmar a identidade.
    =====================================================================
--]]

if requestMethod ~= "GET" then
    httpSetResponseCode(405)
    httpSetResponseHeader("Content-Type", "application/json")
    httpWrite(toJSON({ success = false, error = "Method Not Allowed" }))
    return
end

local apiToken = requestHeaders and requestHeaders["x-api-token"] or ""
if apiToken ~= MTA_STORE_TOKEN then
    httpSetResponseCode(401)
    httpSetResponseHeader("Content-Type", "application/json")
    httpWrite(toJSON({ success = false, error = "Unauthorized" }))
    return
end

httpSetResponseCode(200)
httpSetResponseHeader("Content-Type", "application/json")
httpWrite(toJSON({
    success = true,
    serverTime = os.time(),
    playersOnline = #getElementsByType("player"),
}))

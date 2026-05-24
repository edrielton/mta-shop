--[[
    MTA STORE - autotoken.lua (HTTP Page)
    GET /mta_store/autotoken → status do servidor
--]]

httpSetResponseHeader("Content-Type", "application/json")

local token = requestHeaders and requestHeaders["x-api-token"] or ""
if token ~= MTA_STORE_TOKEN then
    httpSetResponseCode(401)
    httpWrite(toJSON({success=false, error="Unauthorized"}))
    return
end

httpSetResponseCode(200)
httpWrite(toJSON({
    success       = true,
    serverTime    = os.time(),
    playersOnline = #getElementsByType("player"),
}))

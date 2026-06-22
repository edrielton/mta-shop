-- MTA STORE - health.lua (HTTP Page)
-- GET /mta_store/health - health check do servidor

httpSetResponseHeader("Content-Type", "application/json")

if requestMethod ~= "GET" then
    httpSetResponseCode(405)
    httpWrite(toJSON({success=false, error="Method Not Allowed"}))
    return
end

local token = requestHeaders and requestHeaders["x-api-token"] or ""
if token ~= MTA_STORE_TOKEN then
    httpSetResponseCode(401)
    httpWrite(toJSON({success=false, error="Unauthorized"}))
    return
end

httpSetResponseCode(200)
httpWrite(toJSON({
    success=true,
    status="online",
    players=#getElementsByType("player"),
    serverTime=os.time(),
}))

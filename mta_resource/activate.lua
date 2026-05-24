--[[
    MTA STORE - activate.lua (HTTP Page)
    POST /mta_store/activate  → ativa item comprado
    GET  /mta_store/health    → health check
--]]

httpSetResponseHeader("Content-Type", "application/json")
httpSetResponseHeader("X-Powered-By", "MTA-Store")

local function respond(code, data)
    httpSetResponseCode(code)
    httpWrite(toJSON(data))
end

-- Health check
if requestMethod == "GET" then
    local token = requestHeaders and requestHeaders["x-api-token"] or ""
    if token ~= MTA_STORE_TOKEN then
        respond(401, {success=false, error="Unauthorized"})
        return
    end
    respond(200, {success=true, status="online", players=#getElementsByType("player"), serverTime=os.time()})
    return
end

-- Ativação
if requestMethod ~= "POST" then
    respond(405, {success=false, error="Method Not Allowed"})
    return
end

local token = requestHeaders and requestHeaders["x-api-token"] or ""
if token ~= MTA_STORE_TOKEN then
    respond(401, {success=false, error="Unauthorized"})
    return
end

local body = getPostData() or ""
if body == "" then
    respond(400, {success=false, error="Empty body"})
    return
end

local payload = fromJSON(body)
if type(payload) ~= "table" then
    respond(400, {success=false, error="Invalid JSON"})
    return
end

local command       = payload.command
local serial        = payload.serial or ""
local account       = payload.account or ""
local params        = payload.params or {}
local transactionId = payload.transactionId or ""

if not command or command == "" then
    respond(400, {success=false, error="Missing command"})
    return
end

if serial == "" and account == "" then
    respond(400, {success=false, error="Missing serial or account"})
    return
end

if transactionId == "" then
    respond(400, {success=false, error="Missing transactionId"})
    return
end

-- Idempotência
if isTransactionProcessed(transactionId) then
    respond(200, {success=true, duplicate=true, message="Already processed"})
    return
end

local ok, msg = executeProductCommand(command, serial, account, params, transactionId)

if ok then
    markTransactionProcessed(transactionId)
    if msg == "offline_queued" then
        respond(200, {success=true, queued=true, message="Player offline — item queued"})
    else
        respond(200, {success=true, queued=false, message=msg or "OK"})
    end
else
    respond(500, {success=false, error=msg or "Activation failed"})
end

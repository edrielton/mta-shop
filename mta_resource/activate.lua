--[[
    MTA STORE - activate.lua  (HTTP Page)
    =====================================================================
    Recebe requisições do site na URL:
      http://IP:22005/mta_store/activate   <- ativação de produto
      http://IP:22005/mta_store/health     <- health check (GET)

    MELHORIAS v1.1:
      - Endpoint /health para verificação de status pelo painel admin
      - Log de transações duplicadas (idempotência)
      - Resposta com tempo de processamento
      - Headers de segurança adicionais
    =====================================================================
--]]

-- Helper: responde JSON
local function jsonResponse(code, data)
    httpSetResponseCode(code)
    httpSetResponseHeader("Content-Type", "application/json")
    httpSetResponseHeader("X-Powered-By", "MTA-Store/1.1")
    httpWrite(toJSON(data))
end

-- Verifica assinatura HMAC-SHA256
local function verifyHmac(body, receivedSig)
    if not receivedSig or receivedSig == "" then
        return false
    end
    local computed = exports["mta_store"]:computeHmacSha256(MTA_STORE_TOKEN, body)
    return (computed == receivedSig:lower())
end

-- ======================================================================
-- HEALTH CHECK (GET /mta_store/health)
-- Usado pelo painel admin para verificar se o servidor MTA está online
-- ======================================================================

if requestMethod == "GET" then
    local apiToken = requestHeaders and requestHeaders["x-api-token"] or ""

    -- Verifica token mesmo no health check (segurança)
    if apiToken ~= MTA_STORE_TOKEN then
        jsonResponse(401, { success = false, error = "Unauthorized" })
        return
    end

    local playerCount = #getElementsByType("player")

    jsonResponse(200, {
        success    = true,
        status     = "online",
        players    = playerCount,
        resource   = getResourceName(getThisResource()),
        serverTime = os.time(),
    })
    return
end

-- ======================================================================
-- ATIVAÇÃO DE PRODUTO (POST /mta_store/activate)
-- ======================================================================

if requestMethod ~= "POST" then
    jsonResponse(405, { success = false, error = "Method Not Allowed" })
    return
end

local startTime = os.clock()

-- Lê corpo da requisição
local body = getPostData() or ""

if body == "" then
    jsonResponse(400, { success = false, error = "Empty request body" })
    return
end

-- Obtém headers
local apiToken = requestHeaders and requestHeaders["x-api-token"] or ""
local signature = requestHeaders and requestHeaders["x-signature"] or ""

-- 1) Verifica token
if apiToken ~= MTA_STORE_TOKEN then
    outputDebugString("[MTA-Store] Requisição rejeitada: token inválido", 2)
    jsonResponse(401, { success = false, error = "Unauthorized" })
    return
end

-- 2) Verifica assinatura HMAC
if MTA_STORE_REQUIRE_HMAC then
    if not verifyHmac(body, signature) then
        outputDebugString("[MTA-Store] Requisição rejeitada: HMAC inválido", 2)
        jsonResponse(401, { success = false, error = "Invalid signature" })
        return
    end
end

-- 3) Decodifica payload JSON
local payload = fromJSON(body)
if type(payload) ~= "table" then
    jsonResponse(400, { success = false, error = "Invalid JSON payload" })
    return
end

local command       = payload.command
local serial        = payload.serial
local account       = payload.account
local params        = payload.params
local transactionId = payload.transactionId

-- 4) Valida campos obrigatórios
if not command or command == "" then
    jsonResponse(400, { success = false, error = "Missing 'command' field" })
    return
end

if (not serial or serial == "") and (not account or account == "") then
    jsonResponse(400, { success = false, error = "Missing player identifier (serial or account)" })
    return
end

if not transactionId or transactionId == "" then
    jsonResponse(400, { success = false, error = "Missing 'transactionId' field" })
    return
end

-- 5) Verifica idempotência (evita processar a mesma transação duas vezes)
local isDuplicate = exports["mta_store"]:isTransactionProcessed(transactionId)
if isDuplicate then
    outputDebugString("[MTA-Store] Transação duplicada ignorada: " .. transactionId, 3)
    jsonResponse(200, {
        success   = true,
        duplicate = true,
        message   = "Transaction already processed",
    })
    return
end

-- 6) Executa o comando
local ok, msg = exports["mta_store"]:executeProductCommand(
    command,
    serial,
    account,
    params or {},
    transactionId
)

local elapsed = math.floor((os.clock() - startTime) * 1000) -- ms

if ok then
    -- Marca transação como processada (evita duplicatas futuras)
    exports["mta_store"]:markTransactionProcessed(transactionId)

    if msg == "offline_queued" then
        jsonResponse(200, {
            success     = true,
            queued      = true,
            message     = "Player offline - item queued for next login",
            processingMs = elapsed,
        })
    else
        jsonResponse(200, {
            success      = true,
            queued       = false,
            message      = msg or "Activation successful",
            processingMs = elapsed,
        })
    end
else
    outputDebugString("[MTA-Store] Falha na ativação: " .. tostring(msg), 2)
    jsonResponse(500, {
        success = false,
        error   = msg or "Activation failed",
    })
end

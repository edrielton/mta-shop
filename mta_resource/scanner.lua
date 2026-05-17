--[[
    MTA STORE - scanner.lua
    =====================================================================
    Escaneia todos os resources do servidor e envia para o site.
    O admin do site decide quais quer sincronizar com a loja.

    Endpoint: GET /mta_store/scan
    =====================================================================
--]]

if requestMethod ~= "GET" then
    httpSetResponseCode(405)
    httpSetResponseHeader("Content-Type", "application/json")
    httpWrite(toJSON({ success = false, error = "Method Not Allowed" }))
    return
end

-- Verifica token
local apiToken = requestHeaders and requestHeaders["x-api-token"] or ""
if apiToken ~= MTA_STORE_TOKEN then
    httpSetResponseCode(401)
    httpSetResponseHeader("Content-Type", "application/json")
    httpWrite(toJSON({ success = false, error = "Unauthorized" }))
    return
end

-- Escaneia todos os resources
local resources = {}

for _, resource in ipairs(getResources()) do
    local name   = getResourceName(resource)
    local state  = getResourceState(resource)  -- "running", "loaded", "starting", "stopping", "failed"

    -- Lê info do meta.xml
    local info = getResourceInfo(resource, "description") or ""
    local author  = getResourceInfo(resource, "author")  or "desconhecido"
    local version = getResourceInfo(resource, "version") or "?"
    local resType = getResourceInfo(resource, "type")    or "misc"

    -- Conta scripts do resource
    local scriptCount = 0
    local fileCount   = 0

    table.insert(resources, {
        name        = name,
        state       = state,
        description = info,
        author      = author,
        version     = version,
        type        = resType,
    })
end

-- Ordena alfabeticamente
table.sort(resources, function(a, b)
    return a.name:lower() < b.name:lower()
end)

httpSetResponseCode(200)
httpSetResponseHeader("Content-Type", "application/json")
httpWrite(toJSON({
    success       = true,
    total         = #resources,
    running       = (function()
        local c = 0
        for _, r in ipairs(resources) do
            if r.state == "running" then c = c + 1 end
        end
        return c
    end)(),
    scannedAt     = os.time(),
    resources     = resources,
}))

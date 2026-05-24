--[[
    MTA STORE - scanner.lua (HTTP Page)
    GET /mta_store/scan → lista todos os resources
--]]

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

local resources = {}
local running   = 0

for _, resource in ipairs(getResources()) do
    local state = getResourceState(resource)
    if state == "running" then running = running + 1 end
    table.insert(resources, {
        name        = getResourceName(resource),
        state       = state,
        description = getResourceInfo(resource, "description") or "",
        author      = getResourceInfo(resource, "author") or "",
        version     = getResourceInfo(resource, "version") or "?",
        type        = getResourceInfo(resource, "type") or "misc",
    })
end

table.sort(resources, function(a,b) return a.name:lower() < b.name:lower() end)

httpSetResponseCode(200)
httpWrite(toJSON({
    success   = true,
    total     = #resources,
    running   = running,
    scannedAt = os.time(),
    resources = resources,
}))

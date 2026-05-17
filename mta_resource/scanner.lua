--[[
    MTA STORE - scanner.lua v2.0
    =====================================================================
    Scanner inteligente: analisa TODOS os resources e detecta
    automaticamente sistemas vendáveis (VIP, veículos, kits, moedas).

    Para cada item encontrado, envia para o site com dados
    pré-preenchidos. O admin só precisa definir nome e preço.

    Endpoint: GET /mta_store/scan
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

-- ======================================================================
-- DETECTOR DE PADRÕES VIP
-- Tenta ler os tiers/planos do sistema VIP do servidor
-- ======================================================================

local function detectVipTiers(resource, resourceName)
    local tiers = {}

    -- Padrão 1: resource exporta getVipTiers / getPlanos / getVipLevels
    local exportNames = {
        "getVipTiers", "getPlanos", "getVipLevels", "getVipPlans",
        "getVipTypes", "getTiers", "getVipGroups", "getVipList",
        "getNiveis", "getNiveisVip", "getPlansVip",
    }

    for _, fnName in ipairs(exportNames) do
        local ok, result = pcall(function()
            return exports[resourceName][fnName]()
        end)
        if ok and type(result) == "table" then
            for k, v in pairs(result) do
                local tierName = type(v) == "table" and (v.name or v.nome or v.label or tostring(k))
                                  or tostring(v)
                local tierId   = type(v) == "table" and (v.id or v.nivel or k) or k
                table.insert(tiers, {
                    id          = tostring(tierId),
                    name        = tierName,
                    source      = "export:" .. fnName,
                })
            end
            if #tiers > 0 then return tiers end
        end
    end

    -- Padrão 2: nome do resource contém tier comum
    local vipKeywords = {
        { pattern = "gold",    name = "VIP Gold"    },
        { pattern = "ouro",    name = "VIP Ouro"    },
        { pattern = "prata",   name = "VIP Prata"   },
        { pattern = "silver",  name = "VIP Silver"  },
        { pattern = "bronze",  name = "VIP Bronze"  },
        { pattern = "diamond", name = "VIP Diamond" },
        { pattern = "diamante",name = "VIP Diamante"},
        { pattern = "platina", name = "VIP Platina" },
        { pattern = "platinum",name = "VIP Platinum"},
        { pattern = "vip1",    name = "VIP Nível 1" },
        { pattern = "vip2",    name = "VIP Nível 2" },
        { pattern = "vip3",    name = "VIP Nível 3" },
    }

    local lowerName = resourceName:lower()
    for _, kw in ipairs(vipKeywords) do
        if lowerName:find(kw.pattern) then
            table.insert(tiers, {
                id     = kw.pattern,
                name   = kw.name,
                source = "name_pattern",
            })
        end
    end

    -- Padrão 3: tenta ler config.lua do resource via getResourceConfig
    local ok2, cfg = pcall(function()
        return exports[resourceName].getConfig and exports[resourceName].getConfig()
    end)
    if ok2 and type(cfg) == "table" then
        local vipCfg = cfg.vip or cfg.tiers or cfg.planos or cfg.niveis
        if type(vipCfg) == "table" then
            for k, v in pairs(vipCfg) do
                local n = type(v) == "table" and (v.name or v.nome or tostring(k)) or tostring(v)
                table.insert(tiers, { id = tostring(k), name = n, source = "config" })
            end
        end
    end

    return tiers
end

-- ======================================================================
-- DETECTOR DE VEÍCULOS
-- ======================================================================

local function detectVehicles(resource, resourceName)
    local vehicles = {}

    local exportNames = {
        "getVehicleList", "getVeiculos", "getCars",
        "getVehicles", "getCarList", "getCarros",
    }

    for _, fnName in ipairs(exportNames) do
        local ok, result = pcall(function()
            return exports[resourceName][fnName]()
        end)
        if ok and type(result) == "table" then
            for _, v in ipairs(result) do
                table.insert(vehicles, {
                    id    = v.id or v.model or v.modelo,
                    name  = v.name or v.nome or v.label or ("Veículo " .. tostring(v.id or "")),
                    model = v.model or v.modelo or v.id,
                })
            end
            if #vehicles > 0 then return vehicles end
        end
    end

    return vehicles
end

-- ======================================================================
-- DETECTOR DE KITS DE ARMAS
-- ======================================================================

local function detectWeaponKits(resource, resourceName)
    local kits = {}

    local exportNames = {
        "getWeaponKits", "getKits", "getArmas",
        "getWeaponPacks", "getKitsArmas",
    }

    for _, fnName in ipairs(exportNames) do
        local ok, result = pcall(function()
            return exports[resourceName][fnName]()
        end)
        if ok and type(result) == "table" then
            for k, v in pairs(result) do
                local n = type(v) == "table" and (v.name or v.nome or tostring(k)) or tostring(v)
                table.insert(kits, { id = tostring(k), name = n })
            end
            if #kits > 0 then return kits end
        end
    end

    return kits
end

-- ======================================================================
-- DETECTOR DE SISTEMA DE COINS / MOEDAS
-- ======================================================================

local function detectCoinPacks(resource, resourceName)
    local packs = {}

    local exportNames = {
        "getCoinPacks", "getMoedas", "getCoins",
        "getPacotesMoedas", "getCoinPlans",
    }

    for _, fnName in ipairs(exportNames) do
        local ok, result = pcall(function()
            return exports[resourceName][fnName]()
        end)
        if ok and type(result) == "table" then
            for _, v in ipairs(result) do
                table.insert(packs, {
                    amount = v.amount or v.quantidade or v.value or 0,
                    name   = v.name or v.nome or (tostring(v.amount or 0) .. " Moedas"),
                })
            end
            if #packs > 0 then return packs end
        end
    end

    return packs
end

-- ======================================================================
-- CLASSIFICADOR DE RESOURCE
-- Detecta o tipo e itens vendáveis do resource
-- ======================================================================

local function classifyResource(resource, resourceName)
    local lowerName  = resourceName:lower()
    local desc       = getResourceInfo(resource, "description") or ""
    local lowerDesc  = desc:lower()
    local exports    = getResourceExportedFunctions(resource) or {}
    local exportList = {}
    for fnName in pairs(exports) do
        table.insert(exportList, fnName)
    end

    local result = {
        type        = "unknown",
        sellable    = {},   -- itens que podem virar produtos na loja
        exports     = exportList,
    }

    -- ── VIP ───────────────────────────────────────────────────────────
    local isVip = lowerName:find("vip") or lowerDesc:find("vip") or
                  lowerName:find("rank") or lowerName:find("premium") or
                  lowerName:find("doador") or lowerDesc:find("rank")

    if isVip then
        result.type = "vip"
        local tiers = detectVipTiers(resource, resourceName)

        if #tiers > 0 then
            for _, tier in ipairs(tiers) do
                table.insert(result.sellable, {
                    suggestedName    = tier.name,
                    suggestedDesc    = tier.name .. " — acesso especial no servidor.",
                    category         = "vip",
                    mtaCommand       = "giveVip",
                    mtaParams        = { tier = tier.id, days = 30, resource = resourceName },
                    autoDetected     = true,
                    detectionSource  = tier.source,
                })
            end
        else
            -- Resource VIP mas sem tiers detectados: cria produto genérico
            table.insert(result.sellable, {
                suggestedName   = "VIP — " .. resourceName,
                suggestedDesc   = "Acesso VIP do servidor.",
                category        = "vip",
                mtaCommand      = "giveVip",
                mtaParams       = { resource = resourceName, days = 30 },
                autoDetected    = false,
                detectionSource = "resource_name",
            })
        end
        return result
    end

    -- ── VEÍCULOS ──────────────────────────────────────────────────────
    local isVehicle = lowerName:find("vehicle") or lowerName:find("veiculo") or
                      lowerName:find("carro") or lowerName:find("car") or
                      lowerName:find("garage") or lowerName:find("garagem")

    if isVehicle then
        result.type = "vehicle"
        local vehicles = detectVehicles(resource, resourceName)

        if #vehicles > 0 then
            for _, v in ipairs(vehicles) do
                table.insert(result.sellable, {
                    suggestedName  = v.name,
                    suggestedDesc  = v.name .. " — entregue no seu spawn.",
                    category       = "vehicle",
                    mtaCommand     = "giveVehicle",
                    mtaParams      = { vehicleId = v.model, resource = resourceName },
                    autoDetected   = true,
                    detectionSource = "export",
                })
            end
        else
            table.insert(result.sellable, {
                suggestedName   = "Veículo — " .. resourceName,
                suggestedDesc   = "Veículo exclusivo do servidor.",
                category        = "vehicle",
                mtaCommand      = "giveVehicle",
                mtaParams       = { resource = resourceName },
                autoDetected    = false,
                detectionSource = "resource_name",
            })
        end
        return result
    end

    -- ── MOEDAS ────────────────────────────────────────────────────────
    local isCoins = lowerName:find("coin") or lowerName:find("moeda") or
                    lowerName:find("money") or lowerName:find("economia") or
                    lowerName:find("economy") or lowerName:find("cash")

    if isCoins then
        result.type = "coins"
        local packs = detectCoinPacks(resource, resourceName)

        if #packs > 0 then
            for _, p in ipairs(packs) do
                table.insert(result.sellable, {
                    suggestedName   = p.name,
                    suggestedDesc   = p.name .. " para gastar no servidor.",
                    category        = "coins",
                    mtaCommand      = "giveCoins",
                    mtaParams       = { amount = p.amount, resource = resourceName },
                    autoDetected    = true,
                    detectionSource = "export",
                })
            end
        else
            for _, amount in ipairs({ 1000, 5000, 15000 }) do
                table.insert(result.sellable, {
                    suggestedName   = amount .. " Moedas",
                    suggestedDesc   = "Pacote de " .. amount .. " moedas.",
                    category        = "coins",
                    mtaCommand      = "giveCoins",
                    mtaParams       = { amount = amount, resource = resourceName },
                    autoDetected    = false,
                    detectionSource = "default_packs",
                })
            end
        end
        return result
    end

    -- ── ARMAS ─────────────────────────────────────────────────────────
    local isWeapon = lowerName:find("weapon") or lowerName:find("arma") or
                     lowerName:find("kit") or lowerName:find("gun")

    if isWeapon then
        result.type = "weapon"
        local kits  = detectWeaponKits(resource, resourceName)

        if #kits > 0 then
            for _, k in ipairs(kits) do
                table.insert(result.sellable, {
                    suggestedName   = k.name,
                    suggestedDesc   = "Kit de armas — entregue imediatamente.",
                    category        = "item",
                    mtaCommand      = "giveWeaponKit",
                    mtaParams       = { kit = k.id, resource = resourceName },
                    autoDetected    = true,
                    detectionSource = "export",
                })
            end
        else
            for _, kit in ipairs({ "starter", "premium" }) do
                table.insert(result.sellable, {
                    suggestedName   = "Kit " .. kit:sub(1,1):upper() .. kit:sub(2),
                    suggestedDesc   = "Kit de armas " .. kit .. ".",
                    category        = "item",
                    mtaCommand      = "giveWeaponKit",
                    mtaParams       = { kit = kit, resource = resourceName },
                    autoDetected    = false,
                    detectionSource = "default_kits",
                })
            end
        end
        return result
    end

    -- ── SKIN ──────────────────────────────────────────────────────────
    local isSkin = lowerName:find("skin") or lowerName:find("roupa") or
                   lowerName:find("char") or lowerName:find("personagem")

    if isSkin then
        result.type = "skin"
        table.insert(result.sellable, {
            suggestedName   = "Skin — " .. resourceName,
            suggestedDesc   = "Skin exclusiva do servidor.",
            category        = "item",
            mtaCommand      = "giveSkin",
            mtaParams       = { resource = resourceName },
            autoDetected    = false,
            detectionSource = "resource_name",
        })
        return result
    end

    return result
end

-- ======================================================================
-- SCAN PRINCIPAL
-- ======================================================================

local allResources = {}
local allDetected  = {}  -- itens prontos para virar produtos

for _, resource in ipairs(getResources()) do
    local name  = getResourceName(resource)
    local state = getResourceState(resource)

    local info = {
        name        = name,
        state       = state,
        description = getResourceInfo(resource, "description") or "",
        author      = getResourceInfo(resource, "author")      or "",
        version     = getResourceInfo(resource, "version")     or "?",
        type        = getResourceInfo(resource, "type")        or "misc",
        classified  = nil,
        sellable    = {},
    }

    -- Só analisa resources em execução
    if state == "running" then
        local classification = classifyResource(resource, name)
        info.classified = classification.type
        info.sellable   = classification.sellable
        info.exports    = classification.exports

        -- Adiciona itens detectados à lista global
        for _, item in ipairs(classification.sellable) do
            item.resourceName  = name
            item.resourceState = state
            table.insert(allDetected, item)
        end
    end

    table.insert(allResources, info)
end

-- Ordena alfabeticamente
table.sort(allResources, function(a, b)
    return a.name:lower() < b.name:lower()
end)

httpSetResponseCode(200)
httpSetResponseHeader("Content-Type", "application/json")
httpWrite(toJSON({
    success       = true,
    total         = #allResources,
    running       = (function()
        local c = 0
        for _, r in ipairs(allResources) do
            if r.state == "running" then c = c + 1 end
        end
        return c
    end)(),
    detectedItems = #allDetected,  -- total de itens prontos para a loja
    scannedAt     = os.time(),
    resources     = allResources,
    detected      = allDetected,   -- itens pré-configurados para criar produtos
}))

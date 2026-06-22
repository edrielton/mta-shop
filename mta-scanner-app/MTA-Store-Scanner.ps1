# MTA Store Scanner v2.0 - Compativel com PowerShell 5.1+
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ── Cores ────────────────────────────────────────────────────────────
$BG      = [System.Drawing.Color]::FromArgb(15,17,23)
$BG2     = [System.Drawing.Color]::FromArgb(30,33,48)
$BG3     = [System.Drawing.Color]::FromArgb(37,42,58)
$TEXT    = [System.Drawing.Color]::FromArgb(226,232,240)
$MUTED   = [System.Drawing.Color]::FromArgb(100,116,139)
$PRIMARY = [System.Drawing.Color]::FromArgb(59,130,246)
$GREEN   = [System.Drawing.Color]::FromArgb(34,197,94)
$AMBER   = [System.Drawing.Color]::FromArgb(245,158,11)
$RED     = [System.Drawing.Color]::FromArgb(239,68,68)
$PURPLE  = [System.Drawing.Color]::FromArgb(168,85,247)
$FONT    = New-Object System.Drawing.Font("Segoe UI", 9)
$FONTB   = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$FONTM   = New-Object System.Drawing.Font("Consolas", 8)

# ── Estado global ────────────────────────────────────────────────────
$global:Resources  = @()
$global:Detected   = @()
$global:FolderPath = ""
$configFile = "$env:APPDATA\MTA-Store-Scanner.json"

# ── Config ───────────────────────────────────────────────────────────
function LoadConfig {
    if (Test-Path $configFile) {
        try { return (Get-Content $configFile -Raw | ConvertFrom-Json) } catch {}
    }
    return [PSCustomObject]@{ url=""; token=""; folder="" }
}
function SaveConfig($url, $token, $folder) {
    @{ url=$url; token=$token; folder=$folder } | ConvertTo-Json | Set-Content $configFile -Encoding UTF8
}

function Coalesce($a, $b) { if ($null -ne $a -and $a -ne "") { return $a } return $b }

function Validate-Url($url) {
    if (-not $url) { return $false }
    try {
        $u = [System.Uri]$url
        return ($u.Scheme -eq "http" -or $u.Scheme -eq "https")
    } catch { return $false }
}

# ── Parsers Lua ───────────────────────────────────────────────────────
$VIP_KWS     = @("vip","gold","ouro","prata","silver","bronze","diamond","diamante","platina","platinum","premium","doador","rank","vip1","vip2","vip3")
$VEHICLE_KWS = @("vehicle","veiculo","carro","garage","garagem")
$COIN_KWS    = @("coin","moeda","economy","economia","cash","dinheiro","money")
$WEAPON_KWS  = @("weapon","arma","arsenal")

$TIER_MAP = @{
    gold="VIP Gold"; ouro="VIP Ouro"; prata="VIP Prata"; silver="VIP Silver"
    bronze="VIP Bronze"; diamond="VIP Diamond"; diamante="VIP Diamante"
    platina="VIP Platina"; platinum="VIP Platinum"
    vip1="VIP Nivel 1"; vip2="VIP Nivel 2"; vip3="VIP Nivel 3"
    premium="VIP Premium"; doador="VIP Doador"
}

function ParseLua($path) {
    $r = @{ commands=@(); vipTiers=@(); setData=@() }
    try {
        $c = Get-Content $path -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if (-not $c) { return $r }
        foreach ($m in [regex]::Matches($c, 'addCommandHandler\s*\(\s*["' + "'" + ']([^"' + "'" + ']+)["' + "'" + ']', 'IgnoreCase')) {
            $v = $m.Groups[1].Value
            if ($v -and $r.commands -notcontains $v) { $r.commands += $v }
        }
        foreach ($m in [regex]::Matches($c, '(?:name|nome|label|tier|nivel|plano)\s*=\s*["' + "'" + ']([^"' + "'" + ']{2,30})["' + "'" + ']', 'IgnoreCase')) {
            $v = $m.Groups[1].Value
            if ($v -and $r.vipTiers -notcontains $v) { $r.vipTiers += $v }
        }
        foreach ($m in [regex]::Matches($c, 'setElementData\s*\([^,]+,\s*["' + "'" + ']([^"' + "'" + ']+)["' + "'" + ']', 'IgnoreCase')) {
            $v = $m.Groups[1].Value
            if ($v -and $r.setData -notcontains $v) { $r.setData += $v }
        }
    } catch {}
    return $r
}

function ClassifyResource($name, $desc, $luaList) {
    $lname = $name.ToLower()
    $ldesc = (Coalesce $desc "").ToLower()
    $all   = "$lname $ldesc"

    $allCmds  = @($luaList | ForEach-Object { $_.commands } | Select-Object -Unique)
    $allTiers = @($luaList | ForEach-Object { $_.vipTiers })
    $allSD    = @($luaList | ForEach-Object { $_.setData })

    $sellable = @()
    $category = "other"

    $isVip  = ($VIP_KWS     | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0
    $isVip  = $isVip -or (($allSD | Where-Object { $_ -match "vip" } | Measure-Object).Count -gt 0)
    $isVeh  = ($VEHICLE_KWS | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0
    $isCoin = ($COIN_KWS    | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0
    $isWep  = ($WEAPON_KWS  | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0

    if ($isVip) {
        $category = "vip"
        $found = @()
        foreach ($tv in $allTiers) {
            $tvl = $tv.ToLower()
            foreach ($kw in $TIER_MAP.Keys) {
                if ($tvl -match $kw) {
                    $nice = $TIER_MAP[$kw]
                    if (($found | Where-Object { $_.name -eq $nice } | Measure-Object).Count -eq 0) {
                        $found += @{ name=$nice; id=$kw }
                    }
                }
            }
        }
        foreach ($kw in $TIER_MAP.Keys) {
            if ($lname -match $kw) {
                $nice = $TIER_MAP[$kw]
                if (($found | Where-Object { $_.name -eq $nice } | Measure-Object).Count -eq 0) {
                    $found += @{ name=$nice; id=$kw }
                }
            }
        }
        if ($found.Count -gt 0) {
            foreach ($t in $found) {
                $sellable += @{ suggestedName=$t.name; suggestedDesc="$($t.name) - beneficios exclusivos."; category="vip"; mtaCommand="giveVip"; mtaParams=@{tier=$t.id;days=30;resource=$name}; autoDetected=$true; resourceName=$name; luaCommands=$allCmds }
            }
        } else {
            $sellable += @{ suggestedName="VIP - $name"; suggestedDesc="Acesso VIP."; category="vip"; mtaCommand="giveVip"; mtaParams=@{resource=$name;days=30}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds }
        }
    } elseif ($isVeh) {
        $category = "vehicle"
        $sellable += @{ suggestedName="Veiculo - $name"; suggestedDesc="Veiculo entregue no spawn."; category="vehicle"; mtaCommand="giveVehicle"; mtaParams=@{resource=$name}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds }
    } elseif ($isCoin) {
        $category = "coins"
        foreach ($amt in @(1000,5000,15000)) {
            $sellable += @{ suggestedName="$amt Moedas"; suggestedDesc="Pacote de $amt moedas."; category="coins"; mtaCommand="giveCoins"; mtaParams=@{amount=$amt;resource=$name}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds }
        }
    } elseif ($isWep) {
        $category = "weapon"
        foreach ($kit in @("starter","premium")) {
            $sellable += @{ suggestedName="Kit $kit"; suggestedDesc="Kit de armas $kit."; category="item"; mtaCommand="giveWeaponKit"; mtaParams=@{kit=$kit;resource=$name}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds }
        }
    }

    return @{ category=$category; sellable=$sellable; commands=$allCmds }
}

# ── Formulario ───────────────────────────────────────────────────────
$cfg = LoadConfig

$form = New-Object System.Windows.Forms.Form
$form.Text = "MTA Store Scanner v2.0"
$form.Size = New-Object System.Drawing.Size(980,720)
$form.MinimumSize = New-Object System.Drawing.Size(800,580)
$form.BackColor = $BG; $form.ForeColor = $TEXT; $form.Font = $FONT
$form.StartPosition = "CenterScreen"

# Header
$pnlH = New-Object System.Windows.Forms.Panel
$pnlH.Dock = "Top"; $pnlH.Height = 50; $pnlH.BackColor = $BG2
$lTitle = New-Object System.Windows.Forms.Label
$lTitle.Text = "  MTA Store Scanner"; $lTitle.Font = New-Object System.Drawing.Font("Segoe UI",13,$([System.Drawing.FontStyle]::Bold))
$lTitle.ForeColor = $PRIMARY; $lTitle.Location = New-Object System.Drawing.Point(8,12); $lTitle.AutoSize = $true
$lSub = New-Object System.Windows.Forms.Label
$lSub.Text = "Analisa seus mods e envia pro site"; $lSub.ForeColor = $MUTED
$lSub.Location = New-Object System.Drawing.Point(260,16); $lSub.AutoSize = $true
$pnlH.Controls.AddRange(@($lTitle,$lSub))
$form.Controls.Add($pnlH)

# Config
$pnlC = New-Object System.Windows.Forms.Panel
$pnlC.Dock = "Top"; $pnlC.Height = 118; $pnlC.BackColor = $BG2
$pnlC.Padding = New-Object System.Windows.Forms.Padding(14,6,14,6)

function NewLabel($t,$x,$y){ $l=New-Object System.Windows.Forms.Label; $l.Text=$t; $l.ForeColor=$MUTED; $l.Location=New-Object System.Drawing.Point($x,$y); $l.AutoSize=$true; return $l }
function NewInput($x,$y,$w,$pw=$false){ $i=New-Object System.Windows.Forms.TextBox; $i.Location=New-Object System.Drawing.Point($x,$y); $i.Size=New-Object System.Drawing.Size($w,26); $i.BackColor=$BG3; $i.ForeColor=$TEXT; $i.BorderStyle="FixedSingle"; if($pw){$i.UseSystemPasswordChar=$true}; return $i }

$lUrl=$pnlC.Controls.Add((NewLabel "URL do Site:" 14 12))
$tUrl=NewInput 165 8 490; $tUrl.Text=(Coalesce $cfg.url "")
$pnlC.Controls.Add($tUrl)
$lTk=$pnlC.Controls.Add((NewLabel "Token:" 14 46))
$tTk=NewInput 165 42 490 $true; $tTk.Text=(Coalesce $cfg.token "")
$pnlC.Controls.Add($tTk)
$lFd=$pnlC.Controls.Add((NewLabel "Pasta Resources:" 14 80))
$tFd=NewInput 165 76 370; $tFd.ReadOnly=$true; $tFd.Text=(Coalesce $cfg.folder "")
if ($cfg.folder) { $global:FolderPath = $cfg.folder }
$pnlC.Controls.Add($tFd)
$bBrowse=New-Object System.Windows.Forms.Button
$bBrowse.Text="Selecionar Pasta..."; $bBrowse.Location=New-Object System.Drawing.Point(542,75)
$bBrowse.Size=New-Object System.Drawing.Size(150,28); $bBrowse.BackColor=$BG3; $bBrowse.ForeColor=$TEXT; $bBrowse.FlatStyle="Flat"
$pnlC.Controls.Add($bBrowse)
$form.Controls.Add($pnlC)

# Botoes
$pnlB=New-Object System.Windows.Forms.Panel
$pnlB.Dock="Top"; $pnlB.Height=48; $pnlB.BackColor=$BG
$pnlB.Padding=New-Object System.Windows.Forms.Padding(14,8,14,0)
function NewButton($t,$x,$bc,$fc){ $b=New-Object System.Windows.Forms.Button; $b.Text=$t; $b.Location=New-Object System.Drawing.Point($x,6); $b.Size=New-Object System.Drawing.Size(150,32); $b.BackColor=$bc; $b.ForeColor=$fc; $b.FlatStyle="Flat"; $b.Font=$FONTB; return $b }
$bScan=NewButton "Escanear Mods" 0 $PRIMARY $TEXT
$bSend=NewButton "Enviar pro Site" 158 $GREEN $TEXT; $bSend.Enabled=$false
$bExp=NewButton "Exportar JSON" 316 $BG3 $TEXT; $bExp.Enabled=$false
$lCount=New-Object System.Windows.Forms.Label; $lCount.ForeColor=$MUTED; $lCount.Location=New-Object System.Drawing.Point(490,14); $lCount.AutoSize=$true
$pnlB.Controls.AddRange(@($bScan,$bSend,$bExp,$lCount))
$form.Controls.Add($pnlB)

# Progress
$pnlP=New-Object System.Windows.Forms.Panel
$pnlP.Dock="Top"; $pnlP.Height=34; $pnlP.BackColor=$BG
$prog=New-Object System.Windows.Forms.ProgressBar
$prog.Location=New-Object System.Drawing.Point(14,4); $prog.Size=New-Object System.Drawing.Size(940,8); $prog.Style="Continuous"
$lSt=New-Object System.Windows.Forms.Label; $lSt.ForeColor=$MUTED
$lSt.Text="Pronto. Selecione a pasta e clique em Escanear."
$lSt.Location=New-Object System.Drawing.Point(14,16); $lSt.AutoSize=$true
$pnlP.Controls.AddRange(@($prog,$lSt))
$form.Controls.Add($pnlP)

# Log
$pnlLog=New-Object System.Windows.Forms.Panel
$pnlLog.Dock="Bottom"; $pnlLog.Height=110; $pnlLog.BackColor=$BG
$tLog=New-Object System.Windows.Forms.RichTextBox
$tLog.Dock="Fill"; $tLog.ReadOnly=$true; $tLog.BackColor=[System.Drawing.Color]::FromArgb(10,13,20)
$tLog.ForeColor=$MUTED; $tLog.Font=$FONTM; $tLog.BorderStyle="None"; $tLog.ScrollBars="Vertical"
$pnlLog.Controls.Add($tLog)
$form.Controls.Add($pnlLog)

# ListView
$lv=New-Object System.Windows.Forms.ListView
$lv.Dock="Fill"; $lv.View="Details"; $lv.FullRowSelect=$true; $lv.GridLines=$true
$lv.BackColor=$BG2; $lv.ForeColor=$TEXT; $lv.BorderStyle="None"; $lv.Font=$FONTM
foreach ($col in @(@{n="Resource";w=170},@{n="Categoria";w=85},@{n="Item Detectado";w=240},@{n="Comandos no .lua";w=200},@{n="Cmd MTA";w=130},@{n="Auto";w=45})) {
    $ch=New-Object System.Windows.Forms.ColumnHeader; $ch.Text=$col.n; $ch.Width=$col.w
    $lv.Columns.Add($ch)|Out-Null
}
$form.Controls.Add($lv)

# ── Funcoes ───────────────────────────────────────────────────────────
function Log($msg,$color=$null) {
    $ts=(Get-Date).ToString("HH:mm:ss")
    $tLog.SelectionStart=$tLog.TextLength; $tLog.SelectionLength=0
    $tLog.SelectionColor = if($color){$color}else{$MUTED}
    $tLog.AppendText("[$ts] $msg`n"); $tLog.ScrollToCaret()
}
function Status($msg) { $lSt.Text=$msg; $form.Refresh() }

# Browse
$bBrowse.Add_Click({
    $dlg=New-Object System.Windows.Forms.FolderBrowserDialog
    $dlg.Description="Selecione a pasta resources do seu servidor MTA"
    if ($global:FolderPath -and (Test-Path $global:FolderPath)) { $dlg.SelectedPath=$global:FolderPath }
    if ($dlg.ShowDialog()-eq"OK") {
        $global:FolderPath=$dlg.SelectedPath
        $tFd.Text=$dlg.SelectedPath
        Log "Pasta: $($dlg.SelectedPath)" $PRIMARY
    }
})

# Scan
$bScan.Add_Click({
    if (-not $global:FolderPath -or -not (Test-Path $global:FolderPath)) {
        [System.Windows.Forms.MessageBox]::Show("Selecione a pasta resources do MTA.","Atencao")|Out-Null; return
    }
    SaveConfig $tUrl.Text $tTk.Text $global:FolderPath
    $bScan.Enabled=$false; $bSend.Enabled=$false; $bExp.Enabled=$false
    $lv.Items.Clear(); $global:Resources=@(); $global:Detected=@(); $prog.Value=0

    $dirs = Get-ChildItem -Path $global:FolderPath -Directory -ErrorAction SilentlyContinue | Sort-Object Name
    $total = $dirs.Count
    if ($total -eq 0) { Log "Nenhum resource encontrado." $RED; $bScan.Enabled=$true; return }

    Log "Escaneando $total resources..." $PRIMARY
    $done = 0

    foreach ($dir in $dirs) {
        $done++
        $pct = [int]($done/$total*100)
        $prog.Value = $pct
        Status "Escaneando: $($dir.Name) ($done/$total)"
        [System.Windows.Forms.Application]::DoEvents()

        $meta = @{ description=""; author=""; version="?"; type="misc" }
        $mpath = Join-Path $dir.FullName "meta.xml"
        if (Test-Path $mpath) {
            try {
                [xml]$xml = Get-Content $mpath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
                $info = $xml.meta.info
                if ($info) {
                    $meta.description = (Coalesce $info.description "")
                    $meta.author      = (Coalesce $info.author "")
                    $meta.version     = (Coalesce $info.version "?")
                    $meta.type        = (Coalesce $info.type "misc")
                }
            } catch {}
        }

        $luaList = @()
        $luaFiles = Get-ChildItem -Path $dir.FullName -Filter "*.lua" -File -ErrorAction SilentlyContinue
        foreach ($lf in $luaFiles) { $luaList += ParseLua $lf.FullName }

        $result = ClassifyResource $dir.Name $meta.description $luaList

        $entry = @{
            name        = $dir.Name
            description = $meta.description
            author      = $meta.author
            version     = $meta.version
            type        = $meta.type
            category    = $result.category
            commands    = $result.commands
            sellable    = $result.sellable
        }
        $global:Resources += $entry
        $global:Detected  += $result.sellable

        foreach ($item in $result.sellable) {
            $cat  = (Coalesce $item.category "other")
            $cmds = ($item.luaCommands | Select-Object -First 4 | ForEach-Object { "/$_" }) -join "  "
            $auto = if ($item.autoDetected) { "OK" } else { "" }
            $li   = New-Object System.Windows.Forms.ListViewItem($item.resourceName)
            $li.SubItems.Add($cat.ToUpper())|Out-Null
            $li.SubItems.Add($item.suggestedName)|Out-Null
            $li.SubItems.Add($cmds)|Out-Null
            $li.SubItems.Add($item.mtaCommand)|Out-Null
            $li.SubItems.Add($auto)|Out-Null
            $li.ForeColor = switch ($cat) { "vip"{$AMBER} "vehicle"{$PRIMARY} "coins"{$GREEN} "item"{$PURPLE} default{$MUTED} }
            $lv.Items.Add($li)|Out-Null
        }
    }

    $t = $global:Detected.Count
    $prog.Value = 100
    Status "Concluido: $t item(ns) em $($global:Resources.Count) resources."
    Log "Scan OK: $($global:Resources.Count) resources, $t item(ns)." $GREEN
    $lCount.Text = "$t item(ns) / $($global:Resources.Count) resources"
    $bScan.Enabled = $true
    if ($t -gt 0) { $bSend.Enabled=$true; $bExp.Enabled=$true }
})

# Enviar
$bSend.Add_Click({
    $url   = $tUrl.Text.Trim().TrimEnd("/")
    $token = $tTk.Text.Trim()

    if (-not $url) {
        [System.Windows.Forms.MessageBox]::Show("Informe a URL do site.","Atencao")|Out-Null; return
    }
    if (-not (Validate-Url $url)) {
        [System.Windows.Forms.MessageBox]::Show("URL invalida. Comece com https:// (ex: https://mtastore.site)","Atencao")|Out-Null; return
    }
    if (-not $token) {
        [System.Windows.Forms.MessageBox]::Show("Informe o token.","Atencao")|Out-Null; return
    }

    SaveConfig $url $token $global:FolderPath
    $bSend.Enabled=$false; Log "Enviando para $url..." $PRIMARY; [System.Windows.Forms.Application]::DoEvents()
    try {
        $body = @{ source="scanner_app"; trigger="MTA Scanner App"; total=$global:Resources.Count; detected=$global:Detected; resources=$global:Resources; scannedAt=[int][Math]::Floor(([datetime]::UtcNow - [datetime]"1970-01-01T00:00:00Z").TotalSeconds) } | ConvertTo-Json -Depth 10
        $resp = Invoke-RestMethod -Uri "$url/api/mta/sync" -Method POST -Body $body -ContentType "application/json; charset=utf-8" -Headers @{"X-API-Token"=$token} -TimeoutSec 25
        $msg  = "Enviado! $($resp.total) item(ns), $($resp.created) criado(s), $($resp.skipped) ja existiam."
        Log $msg $GREEN; Status $msg
        [System.Windows.Forms.MessageBox]::Show($msg,"Sucesso!",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)|Out-Null
    } catch {
        $e = $_.Exception.Message
        if ($e -match "401|Unauthorized") {
            Log "ERRO: Token invalido. Verifique o token nas configuracoes do site." $RED
            [System.Windows.Forms.MessageBox]::Show("Token invalido. Verifique o token nas configuracoes do site.","Erro",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)|Out-Null
        } elseif ($e -match "404|Not Found") {
            Log "ERRO: Endpoint nao encontrado. Verifique a URL do site." $RED
            [System.Windows.Forms.MessageBox]::Show("Endpoint nao encontrado. Verifique a URL do site.","Erro",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)|Out-Null
        } elseif ($e -match "timeout|timed out") {
            Log "ERRO: Tempo esgotado. O site pode estar offline." $RED
            [System.Windows.Forms.MessageBox]::Show("Tempo esgotado. O site pode estar offline.","Erro",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)|Out-Null
        } else {
            Log "ERRO: $e" $RED; Status "Erro ao enviar."
            [System.Windows.Forms.MessageBox]::Show("Erro: $e","Erro",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)|Out-Null
        }
    }
    $bSend.Enabled=$true
})

# Exportar
$bExp.Add_Click({
    $dlg=New-Object System.Windows.Forms.SaveFileDialog; $dlg.Filter="JSON|*.json"; $dlg.FileName="mta_scan.json"
    if ($dlg.ShowDialog()-eq"OK") {
        @{ resources=$global:Resources; detected=$global:Detected } | ConvertTo-Json -Depth 10 | Set-Content $dlg.FileName -Encoding UTF8
        Log "JSON salvo: $($dlg.FileName)" $GREEN
    }
})

Log "Pronto. Selecione a pasta resources do MTA e clique em Escanear."
[System.Windows.Forms.Application]::Run($form)

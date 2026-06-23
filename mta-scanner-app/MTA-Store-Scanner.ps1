# MTA Store Scanner v4.0 - Compativel com PowerShell 5.1+
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$BG      = [System.Drawing.Color]::FromArgb(12,14,20)
$BG2     = [System.Drawing.Color]::FromArgb(22,25,37)
$BG3     = [System.Drawing.Color]::FromArgb(32,36,52)
$BG4     = [System.Drawing.Color]::FromArgb(42,47,66)
$TEXT    = [System.Drawing.Color]::FromArgb(226,232,240)
$MUTED   = [System.Drawing.Color]::FromArgb(100,116,139)
$PRIMARY = [System.Drawing.Color]::FromArgb(99,102,241)
$GREEN   = [System.Drawing.Color]::FromArgb(34,197,94)
$AMBER   = [System.Drawing.Color]::FromArgb(251,191,36)
$RED     = [System.Drawing.Color]::FromArgb(239,68,68)
$PURPLE  = [System.Drawing.Color]::FromArgb(168,85,247)
$TEAL    = [System.Drawing.Color]::FromArgb(20,184,166)
$PINK    = [System.Drawing.Color]::FromArgb(236,72,153)
$FONT    = New-Object System.Drawing.Font("Segoe UI", 9)
$FONTB   = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$FONTS   = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$FONTH   = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$FONTM   = New-Object System.Drawing.Font("Cascadia Code", 8.5)
$FONTC   = New-Object System.Drawing.Font("Cascadia Code", 11, [System.Drawing.FontStyle]::Bold)

$global:Resources  = @()
$global:Detected   = @()
$global:FolderPath = ""
$configFile = "$env:APPDATA\MTA-Store-Scanner.json"

function LoadConfig {
    if (Test-Path $configFile) {
        try { return (Get-Content $configFile -Raw | ConvertFrom-Json) } catch {}
    }
    return [PSCustomObject]@{ url="https://mtastore.site"; token=""; folder=""; depth=10 }
}
function SaveConfig($url, $token, $folder, $depth) {
    @{ url=$url; token=$token; folder=$folder; depth=$depth } | ConvertTo-Json | Set-Content $configFile -Encoding UTF8
}

function Coalesce($a, $b) { if ($null -ne $a -and $a -ne "") { return $a } return $b }

function Validate-Url($url) {
    if (-not $url) { return $false }
    try { $u = [System.Uri]$url; return ($u.Scheme -eq "http" -or $u.Scheme -eq "https") } catch { return $false }
}

$VIP_KWS     = @("vip","gold","ouro","prata","silver","bronze","diamond","diamante","platina","platinum","premium","doador","rank","vip1","vip2","vip3")
$VEHICLE_KWS = @("vehicle","veiculo","carro","garage","garagem","car","auto")
$COIN_KWS    = @("coin","moeda","economy","economia","cash","dinheiro","money")
$WEAPON_KWS  = @("weapon","arma","arsenal","gun","kit")
$HOUSE_KWS   = @("house","casa","property","propriedade","apartamento","mansion")
$JOB_KWS     = @("job","emprego","work","trabalho","farming","mineracao")

$TIER_MAP = @{
    gold="VIP Gold"; ouro="VIP Ouro"; prata="VIP Prata"; silver="VIP Silver"
    bronze="VIP Bronze"; diamond="VIP Diamond"; diamante="VIP Diamante"
    platina="VIP Platina"; platinum="VIP Platinum"
    vip1="VIP Nivel 1"; vip2="VIP Nivel 2"; vip3="VIP Nivel 3"
    premium="VIP Premium"; doador="VIP Doador"
}

$PRICE_ESTIMATES = @{
    vip=@(19.90, 29.90, 49.90, 79.90, 99.90)
    vehicle=@(15.00, 25.00, 35.00, 50.00, 75.00)
    coins=@(5.00, 15.00, 30.00)
    weapon=@(10.00, 20.00, 35.00)
    house=@(20.00, 40.00, 60.00)
    job=@(8.00, 15.00, 25.00)
    other=@(9.90, 19.90, 29.90)
}

function Get-EstimatedPrice($category, $tierIndex) {
    $prices = $PRICE_ESTIMATES[$category]
    if ($null -eq $prices) { $prices = $PRICE_ESTIMATES["other"] }
    if ($tierIndex -lt $prices.Count) { return $prices[$tierIndex] }
    return $prices[-1]
}

function ParseLua($path) {
    $r = @{ commands=@(); vipTiers=@(); setData=@(); functions=@(); exports=@() }
    try {
        $c = Get-Content $path -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if (-not $c) { return $r }
        foreach ($m in [regex]::Matches($c, "addCommandHandler\s*\(\s*[`"']([^`"']+)[`"']", 'IgnoreCase')) {
            $v = $m.Groups[1].Value
            if ($v -and $r.commands -notcontains $v) { $r.commands += $v }
        }
        foreach ($m in [regex]::Matches($c, "(?:name|nome|label|tier|nivel|plano)\s*=\s*[`"']([^`"']{2,30})[`"']", 'IgnoreCase')) {
            $v = $m.Groups[1].Value
            if ($v -and $r.vipTiers -notcontains $v) { $r.vipTiers += $v }
        }
        foreach ($m in [regex]::Matches($c, "setElementData\s*\([^,]+,\s*[`"']([^`"']+)[`"']", 'IgnoreCase')) {
            $v = $m.Groups[1].Value
            if ($v -and $r.setData -notcontains $v) { $r.setData += $v }
        }
        foreach ($m in [regex]::Matches($c, "^(?:export\s+)?function\s+([a-zA-Z_]\w*)\s*\(", 'Multiline,IgnoreCase')) {
            $v = $m.Groups[1].Value
            if ($v -and $r.functions -notcontains $v) { $r.functions += $v }
        }
        foreach ($m in [regex]::Matches($c, "<export\s+.*?function=""([^""]+)""", 'IgnoreCase')) {
            $v = $m.Groups[1].Value
            if ($v -and $r.exports -notcontains $v) { $r.exports += $v }
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
    $allFuncs = @($luaList | ForEach-Object { $_.functions })
    $allExp   = @($luaList | ForEach-Object { $_.exports })

    $sellable = @()
    $category = "other"

    $isVip  = ($VIP_KWS     | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0
    $isVip  = $isVip -or (($allSD | Where-Object { $_ -match "vip" } | Measure-Object).Count -gt 0)
    $isVeh  = ($VEHICLE_KWS | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0
    $isCoin = ($COIN_KWS    | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0
    $isWep  = ($WEAPON_KWS  | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0
    $isHouse= ($HOUSE_KWS   | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0
    $isJob  = ($JOB_KWS     | Where-Object { $all -match $_ } | Measure-Object).Count -gt 0

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
        $idx = 0
        if ($found.Count -gt 0) {
            foreach ($t in $found) {
                $price = Get-EstimatedPrice "vip" $idx
                $sellable += @{ suggestedName=$t.name; suggestedDesc="$($t.name) - beneficios exclusivos no servidor."; category="vip"; mtaCommand="giveVip"; mtaParams=@{tier=$t.id;days=30;resource=$name}; autoDetected=$true; resourceName=$name; luaCommands=$allCmds; estimatedPrice=$price; functions=$allFuncs; exports=$allExp }
                $idx++
            }
        } else {
            $price = Get-EstimatedPrice "vip" 0
            $sellable += @{ suggestedName="VIP - $name"; suggestedDesc="Acesso VIP do servidor."; category="vip"; mtaCommand="giveVip"; mtaParams=@{resource=$name;days=30}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds; estimatedPrice=$price; functions=$allFuncs; exports=$allExp }
        }
    } elseif ($isVeh) {
        $category = "vehicle"
        $idx = 0
        foreach ($vehType in @("Basico","Standard","Premium","Exclusivo")) {
            $price = Get-EstimatedPrice "vehicle" $idx
            $sellable += @{ suggestedName="Veiculo $vehType - $name"; suggestedDesc="Veiculo $vehType entregue no spawn."; category="vehicle"; mtaCommand="giveVehicle"; mtaParams=@{resource=$name;tier=$vehType.ToLower()}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds; estimatedPrice=$price; functions=$allFuncs; exports=$allExp }
            $idx++
        }
    } elseif ($isCoin) {
        $category = "coins"
        $idx = 0
        foreach ($amt in @(1000,5000,15000,50000)) {
            $price = Get-EstimatedPrice "coins" $idx
            $sellable += @{ suggestedName="$amt Moedas"; suggestedDesc="Pacote de $amt moedas do servidor."; category="coins"; mtaCommand="giveCoins"; mtaParams=@{amount=$amt;resource=$name}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds; estimatedPrice=$price; functions=$allFuncs; exports=$allExp }
            $idx++
        }
    } elseif ($isWep) {
        $category = "weapon"
        $idx = 0
        foreach ($kit in @("Starter","Premium","Elite")) {
            $price = Get-EstimatedPrice "weapon" $idx
            $sellable += @{ suggestedName="Kit $kit - $name"; suggestedDesc="Kit de armas $kit do servidor."; category="item"; mtaCommand="giveWeaponKit"; mtaParams=@{kit=$kit.ToLower();resource=$name}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds; estimatedPrice=$price; functions=$allFuncs; exports=$allExp }
            $idx++
        }
    } elseif ($isHouse) {
        $category = "other"
        $idx = 0
        foreach ($tier in @("Pequena","Media","Grande","Mansao")) {
            $price = Get-EstimatedPrice "house" $idx
            $sellable += @{ suggestedName="Propriedade $tier"; suggestedDesc="Propriedade tipo $tier no servidor."; category="item"; mtaCommand="giveProperty"; mtaParams=@{tier=$tier.ToLower();resource=$name}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds; estimatedPrice=$price; functions=$allFuncs; exports=$allExp }
            $idx++
        }
    } elseif ($isJob) {
        $category = "other"
        $price = Get-EstimatedPrice "job" 0
        $sellable += @{ suggestedName="VIP Emprego - $name"; suggestedDesc="Acesso a empregos exclusivos."; category="item"; mtaCommand="giveJobAccess"; mtaParams=@{resource=$name}; autoDetected=$false; resourceName=$name; luaCommands=$allCmds; estimatedPrice=$price; functions=$allFuncs; exports=$allExp }
    }

    return @{ category=$category; sellable=$sellable; commands=$allCmds; functions=$allFuncs; exports=$allExp }
}

$cfg = LoadConfig

$form = New-Object System.Windows.Forms.Form
$form.Text = "MTA Store Scanner v4.0"
$form.Size = New-Object System.Drawing.Size(1200,800)
$form.MinimumSize = New-Object System.Drawing.Size(900,600)
$form.BackColor = $BG; $form.ForeColor = $TEXT; $form.Font = $FONT
$form.StartPosition = "CenterScreen"
$form.Icon = [System.Drawing.SystemIcons]::Application

$pnlH = New-Object System.Windows.Forms.Panel
$pnlH.Dock = "Top"; $pnlH.Height = 56; $pnlH.BackColor = $BG2
$pnlH.Padding = New-Object System.Windows.Forms.Padding(16,0,16,0)

$pnlGradient = New-Object System.Windows.Forms.Panel
$pnlGradient.Dock = "Top"; $pnlGradient.Height = 3; $pnlGradient.BackColor = $PRIMARY

$lTitle = New-Object System.Windows.Forms.Label
$lTitle.Text = "MTA Store Scanner"; $lTitle.Font = $FONTH
$lTitle.ForeColor = $PRIMARY; $lTitle.Location = New-Object System.Drawing.Point(16,12); $lTitle.AutoSize = $true

$lSub = New-Object System.Windows.Forms.Label
$lSub.Text = "Analisa seus mods, detecta itens vendaveis e envia pro site"; $lSub.ForeColor = $MUTED; $lSub.Font = $FONT
$lSub.Location = New-Object System.Drawing.Point(16,34); $lSub.AutoSize = $true

$lVer = New-Object System.Windows.Forms.Label
$lVer.Text = "v4.0"; $lVer.ForeColor = $PRIMARY; $lVer.Font = $FONTB
$lVer.Location = New-Object System.Drawing.Point(1140,20); $lVer.AutoSize = $true

$pnlH.Controls.AddRange(@($lTitle,$lSub,$lVer))
$form.Controls.Add($pnlGradient)
$form.Controls.Add($pnlH)

$pnlC = New-Object System.Windows.Forms.Panel
$pnlC.Dock = "Top"; $pnlC.Height = 110; $pnlC.BackColor = $BG2
$pnlC.Padding = New-Object System.Windows.Forms.Padding(16,6,16,6)

function NewLabel($t,$x,$y,$c=$MUTED){ $l=New-Object System.Windows.Forms.Label; $l.Text=$t; $l.ForeColor=$c; $l.Location=New-Object System.Drawing.Point($x,$y); $l.AutoSize=$true; return $l }
function NewInput($x,$y,$w,$pw=$false){ $i=New-Object System.Windows.Forms.TextBox; $i.Location=New-Object System.Drawing.Point($x,$y); $i.Size=New-Object System.Drawing.Size($w,26); $i.BackColor=$BG3; $i.ForeColor=$TEXT; $i.BorderStyle="FixedSingle"; if($pw){$i.UseSystemPasswordChar=$true}; return $i }

$lbl=NewLabel "URL do Site:" 16 14; $pnlC.Controls.Add($lbl)
$tUrl=NewInput 170 10 480; $tUrl.Text=(Coalesce $cfg.url "https://mtastore.site"); $pnlC.Controls.Add($tUrl)

$lbl2=NewLabel "Token:" 16 48; $pnlC.Controls.Add($lbl2)
$tTk=NewInput 170 44 480 $true; $tTk.Text=(Coalesce $cfg.token ""); $pnlC.Controls.Add($tTk)

$lbl3=NewLabel "Pasta Resources:" 16 82; $pnlC.Controls.Add($lbl3)
$tFd=NewInput 170 78 360; $tFd.ReadOnly=$true; $tFd.Text=(Coalesce $cfg.folder ""); $pnlC.Controls.Add($tFd)
if ($cfg.folder) { $global:FolderPath = $cfg.folder }

$bBrowse=New-Object System.Windows.Forms.Button
$bBrowse.Text="Selecionar..."; $bBrowse.Location=New-Object System.Drawing.Point(536,77)
$bBrowse.Size=New-Object System.Drawing.Size(115,28); $bBrowse.BackColor=$BG4; $bBrowse.ForeColor=$TEXT; $bBrowse.FlatStyle="Flat"; $bBrowse.FlatAppearance.BorderColor=$PRIMARY
$pnlC.Controls.Add($bBrowse)

$lbl4=NewLabel "Profundidade:" 16 116; $pnlC.Controls.Add($lbl4)
$tDepth=NewInput 170 112 60; $tDepth.Text=([string](Coalesce $cfg.depth 10)); $pnlC.Controls.Add($tDepth)
$lbl4b=NewLabel "subpastas (max 20)" 240 116; $pnlC.Controls.Add($lbl4b)
$pnlC.Height = 146
$form.Controls.Add($pnlC)

$pnlB=New-Object System.Windows.Forms.Panel
$pnlB.Dock="Top"; $pnlB.Height=50; $pnlB.BackColor=$BG
$pnlB.Padding=New-Object System.Windows.Forms.Padding(16,10,16,0)

function NewButton($t,$x,$bc,$fc,$ec=$bc){ $b=New-Object System.Windows.Forms.Button; $b.Text=$t; $b.Location=New-Object System.Drawing.Point($x,8); $b.Size=New-Object System.Drawing.Size(160,32); $b.BackColor=$bc; $b.ForeColor=$fc; $b.FlatStyle="Flat"; $b.Font=$FONTB; $b.FlatAppearance.BorderColor=$ec; return $b }

$bScan=NewButton "Escanear Mods" 0 $PRIMARY $TEXT $PRIMARY
$bSend=NewButton "Enviar pro Site" 168 $GREEN $TEXT $GREEN; $bSend.Enabled=$false
$bExp=NewButton "Exportar JSON" 336 $BG4 $TEXT $MUTED; $bExp.Enabled=$false

$lCount=New-Object System.Windows.Forms.Label; $lCount.ForeColor=$MUTED; $lCount.Font=$FONTB
$lCount.Location=New-Object System.Drawing.Point(520,16); $lCount.AutoSize=$true

$pnlB.Controls.AddRange(@($bScan,$bSend,$bExp,$lCount))
$form.Controls.Add($pnlB)

$pnlP=New-Object System.Windows.Forms.Panel
$pnlP.Dock="Top"; $pnlP.Height=36; $pnlP.BackColor=$BG
$prog=New-Object System.Windows.Forms.ProgressBar
$prog.Location=New-Object System.Drawing.Point(16,6); $prog.Size=New-Object System.Drawing.Size(1160,6); $prog.Style="Continuous"
$lSt=New-Object System.Windows.Forms.Label; $lSt.ForeColor=$MUTED; $lSt.Font=$FONT
$lSt.Text="Pronto. Selecione a pasta e clique em Escanear."; $lSt.Location=New-Object System.Drawing.Point(16,18); $lSt.AutoSize=$true
$pnlP.Controls.AddRange(@($prog,$lSt))
$form.Controls.Add($pnlP)

$pnlLog=New-Object System.Windows.Forms.Panel
$pnlLog.Dock="Bottom"; $pnlLog.Height=100; $pnlLog.BackColor=$BG
$pnlLog.Padding=New-Object System.Windows.Forms.Padding(16,8,16,8)
$tLog=New-Object System.Windows.Forms.RichTextBox
$tLog.Dock="Fill"; $tLog.ReadOnly=$true; $tLog.BackColor=[System.Drawing.Color]::FromArgb(8,10,16)
$tLog.ForeColor=$MUTED; $tLog.Font=$FONTM; $tLog.BorderStyle="None"; $tLog.ScrollBars="Vertical"
$pnlLog.Controls.Add($tLog)
$form.Controls.Add($pnlLog)

$lv=New-Object System.Windows.Forms.ListView
$lv.Dock="Fill"; $lv.View="Details"; $lv.FullRowSelect=$true; $lv.GridLines=$false
$lv.BackColor=$BG2; $lv.ForeColor=$TEXT; $lv.BorderStyle="None"; $lv.Font=$FONTM
$lv.OwnerDraw=$true
$lv.HeaderStyle="Nonclickable"
foreach ($col in @(@{n="Resource";w=160},@{n="Categoria";w=80},@{n="Item Detectado";w=220},@{n="Comando Ativacao";w=140},@{n="Preco Est.";w=90},@{n="Comandos Lua";w=180},@{n="Auto";w=45})) {
    $ch=New-Object System.Windows.Forms.ColumnHeader; $ch.Text=$col.n; $ch.Width=$col.w
    $lv.Columns.Add($ch)|Out-Null
}
$form.Controls.Add($lv)

function Log($msg,$color=$null) {
    $ts=(Get-Date).ToString("HH:mm:ss")
    $tLog.SelectionStart=$tLog.TextLength; $tLog.SelectionLength=0
    $tLog.SelectionColor = if($color){$color}else{$MUTED}
    $tLog.AppendText("[$ts] $msg`n"); $tLog.ScrollToCaret()
}
function Status($msg) { $lSt.Text=$msg; $form.Refresh() }

$lv.Add_DrawItem({
    param($sender, $e)
    $e.DrawBackground()
    $row = $e.Bounds
    $item = $lv.Items[$e.ItemIndex]
    $cat = $item.SubItems[1].Text.ToLower()
    $back = if ($e.ItemIndex % 2 -eq 0) { $BG2 } else { $BG3 }
    $e.Graphics.FillRectangle((New-Object System.Drawing.SolidBrush $back), $row)

    $colors = @{ vip=$AMBER; vehicle=$PRIMARY; coins=$GREEN; item=$PURPLE; other=$MUTED }
    $fg = if ($colors.ContainsKey($cat)) { $colors[$cat] } else { $TEXT }

    for ($i=0; $i -lt $item.SubItems.Count; $i++) {
        $subRect = New-Object System.Drawing.Rectangle($row.X + $lv.Columns[$i].X, $row.Y, $lv.Columns[$i].Width, $row.Height)
        $brush = if ($i -eq 1) { New-Object System.Drawing.SolidBrush $fg } elseif ($i -eq 4) { New-Object System.Drawing.SolidBrush $GREEN } else { New-Object System.Drawing.SolidBrush $TEXT }
        $e.Graphics.DrawString($item.SubItems[$i].Text, $lv.Font, $brush, ($subRect.X + 6), ($subRect.Y + 4))
        $brush.Dispose()
    }
    $e.DrawFocusRectangle()
})

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

$bScan.Add_Click({
    if (-not $global:FolderPath -or -not (Test-Path $global:FolderPath)) {
        [System.Windows.Forms.MessageBox]::Show("Selecione a pasta resources do MTA.","Atencao")|Out-Null; return
    }
    $maxDepth = 10
    try { $maxDepth = [Math]::Min([Math]::Max([int]$tDepth.Text, 1), 20) } catch {}
    SaveConfig $tUrl.Text $tTk.Text $global:FolderPath $maxDepth
    $bScan.Enabled=$false; $bSend.Enabled=$false; $bExp.Enabled=$false
    $lv.Items.Clear(); $global:Resources=@(); $global:Detected=@(); $prog.Value=0

    $dirs = Get-ChildItem -Path $global:FolderPath -Directory -Recurse -Depth ($maxDepth - 1) -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName "meta.xml") } | Sort-Object FullName
    $total = $dirs.Count
    if ($total -eq 0) { Log "Nenhum resource encontrado (nenhum meta.xml nas subpastas)." $RED; $bScan.Enabled=$true; return }

    Log "Escaneando $total resources (recursivo, profundidade=$maxDepth)..." $PRIMARY
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
        $luaFiles = Get-ChildItem -Path $dir.FullName -Filter "*.lua" -File -Recurse -ErrorAction SilentlyContinue
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
            functions   = $result.functions
            exports     = $result.exports
            sellable    = $result.sellable
            luaFileCount= $luaFiles.Count
        }
        $global:Resources += $entry
        $global:Detected  += $result.sellable

        foreach ($item in $result.sellable) {
            $cat  = (Coalesce $item.category "other")
            $cmds = ($item.luaCommands | Select-Object -First 3 | ForEach-Object { "/$_" }) -join "  "
            $auto = if ($item.autoDetected) { "OK" } else { "" }
            $price = "R$$([math]::Round($item.estimatedPrice,2))"
            $li   = New-Object System.Windows.Forms.ListViewItem($item.resourceName)
            $li.SubItems.Add($cat.ToUpper())|Out-Null
            $li.SubItems.Add($item.suggestedName)|Out-Null
            $li.SubItems.Add($item.mtaCommand)|Out-Null
            $li.SubItems.Add($price)|Out-Null
            $li.SubItems.Add($cmds)|Out-Null
            $li.SubItems.Add($auto)|Out-Null
            $lv.Items.Add($li)|Out-Null
        }
    }

    $t = $global:Detected.Count
    $prog.Value = 100
    Status "Concluido: $t item(ns) em $($global:Resources.Count) resources."
    Log "Scan OK: $($global:Resources.Count) resources, $t item(ns) detectado(s)." $GREEN
    $lCount.Text = "$t itens  |  $($global:Resources.Count) resources"
    $bScan.Enabled = $true
    if ($t -gt 0) { $bSend.Enabled=$true; $bExp.Enabled=$true }
})

$bSend.Add_Click({
    $url   = $tUrl.Text.Trim().TrimEnd("/")
    $token = $tTk.Text.Trim()

    if (-not $url) {
        [System.Windows.Forms.MessageBox]::Show("Informe a URL do site.","Atencao")|Out-Null; return
    }
    if (-not (Validate-Url $url)) {
        [System.Windows.Forms.MessageBox]::Show("URL invalida. Comece com https://","Atencao")|Out-Null; return
    }
    if (-not $token) {
        [System.Windows.Forms.MessageBox]::Show("Informe o token.","Atencao")|Out-Null; return
    }

    SaveConfig $url $token $global:FolderPath $maxDepth
    $bSend.Enabled=$false; Log "Enviando para $url..." $PRIMARY; Status "Enviando..."; [System.Windows.Forms.Application]::DoEvents()
    try {
        $body = @{ source="scanner_app_v4"; trigger="MTA Scanner App"; total=$global:Resources.Count; detected=$global:Detected; resources=$global:Resources; scannedAt=[int][Math]::Floor(([datetime]::UtcNow - [datetime]"1970-01-01T00:00:00Z").TotalSeconds) } | ConvertTo-Json -Depth 10
        $resp = Invoke-RestMethod -Uri "$url/api/mta/sync" -Method POST -Body $body -ContentType "application/json; charset=utf-8" -Headers @{"X-API-Token"=$token} -TimeoutSec 30
        $msg  = "Enviado com sucesso! $($resp.total) item(ns) detectado(s)."
        Log $msg $GREEN; Status $msg
        [System.Windows.Forms.MessageBox]::Show($msg,"Sucesso!",[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)|Out-Null
    } catch {
        $e = $_.Exception.Message
        if ($e -match "401|Unauthorized") {
            Log "ERRO: Token invalido." $RED
            [System.Windows.Forms.MessageBox]::Show("Token invalido. Verifique o token nas configuracoes do site.","Erro")|Out-Null
        } elseif ($e -match "404|Not Found") {
            Log "ERRO: Endpoint nao encontrado. Verifique a URL." $RED
            [System.Windows.Forms.MessageBox]::Show("Endpoint nao encontrado. Verifique a URL do site.","Erro")|Out-Null
        } elseif ($e -match "timeout|timed out") {
            Log "ERRO: Tempo esgotado. Site pode estar offline." $RED
            [System.Windows.Forms.MessageBox]::Show("Tempo esgotado. O site pode estar offline.","Erro")|Out-Null
        } else {
            Log "ERRO: $e" $RED; Status "Erro ao enviar."
            [System.Windows.Forms.MessageBox]::Show("Erro: $e","Erro")|Out-Null
        }
    }
    $bSend.Enabled=$true
})

$bExp.Add_Click({
    $dlg=New-Object System.Windows.Forms.SaveFileDialog; $dlg.Filter="JSON|*.json"; $dlg.FileName="mta_scan.json"
    if ($dlg.ShowDialog()-eq"OK") {
        @{ resources=$global:Resources; detected=$global:Detected } | ConvertTo-Json -Depth 10 | Set-Content $dlg.FileName -Encoding UTF8
        Log "JSON salvo: $($dlg.FileName)" $GREEN
    }
})

Log "MTA Store Scanner v4.0 pronto."
Log "1) URL do site ja preenchida  2) Cole o token  3) Selecione a pasta  4) Clique em Escanear"
[System.Windows.Forms.Application]::Run($form)
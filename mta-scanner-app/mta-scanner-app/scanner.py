#!/usr/bin/env python3
"""
MTA Store Scanner - v1.0
Analisa a pasta resources do MTA e envia para o site automaticamente.
"""

import os
import re
import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import threading
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime

# ── Constantes ─────────────────────────────────────────────────────────────

APP_TITLE   = "MTA Store Scanner v1.0"
CONFIG_FILE = "scanner_config.json"

VIP_KEYWORDS = [
    "vip","gold","ouro","prata","silver","bronze","diamond",
    "diamante","platina","platinum","premium","doador","rank",
    "vip1","vip2","vip3","nivel1","nivel2","nivel3",
]

VEHICLE_KEYWORDS = [
    "vehicle","veiculo","carro","garage","garagem","car","auto",
]

COIN_KEYWORDS = [
    "coin","moeda","economy","economia","cash","dinheiro","money",
]

WEAPON_KEYWORDS = [
    "weapon","arma","kit","gun","arsenal",
]

CATEGORY_MAP = {
    "vip":     "vip",
    "vehicle": "vehicle",
    "coins":   "coins",
    "weapon":  "item",
    "other":   "item",
}

# ── Parser de Lua ───────────────────────────────────────────────────────────

def parse_lua_file(filepath):
    """Extrai informações relevantes de um arquivo Lua."""
    result = {
        "commands":  [],   # addCommandHandler("cmd", ...)
        "exports":   [],   # função exportada
        "vip_tiers": [],   # tiers de VIP detectados
        "setData":   [],   # setElementData com chaves relevantes
        "raw_lines":  0,
    }

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception:
        return result

    lines = content.splitlines()
    result["raw_lines"] = len(lines)

    # Comandos: addCommandHandler("nome", ...)
    cmd_pattern = re.compile(
        r'addCommandHandler\s*\(\s*["\']([^"\']+)["\']',
        re.IGNORECASE
    )
    for match in cmd_pattern.finditer(content):
        cmd = match.group(1).strip()
        if cmd and cmd not in result["commands"]:
            result["commands"].append(cmd)

    # Exports: function exportedFn(
    export_pattern = re.compile(
        r'^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(',
        re.MULTILINE
    )
    for match in export_pattern.finditer(content):
        fn = match.group(1)
        if fn not in result["exports"]:
            result["exports"].append(fn)

    # VIP tiers em tabelas Lua: name = "Gold", tier = "Prata", etc.
    tier_pattern = re.compile(
        r'(?:name|nome|label|tier|nivel|plano)\s*=\s*["\']([^"\']{2,30})["\']',
        re.IGNORECASE
    )
    for match in tier_pattern.finditer(content):
        val = match.group(1).strip()
        if val and val not in result["vip_tiers"]:
            result["vip_tiers"].append(val)

    # setElementData com chaves de VIP/moedas
    setdata_pattern = re.compile(
        r'setElementData\s*\([^,]+,\s*["\']([^"\']+)["\']',
        re.IGNORECASE
    )
    for match in setdata_pattern.finditer(content):
        key = match.group(1).strip()
        if key and key not in result["setData"]:
            result["setData"].append(key)

    return result


def parse_meta_xml(filepath):
    """Lê meta.xml e retorna info básica."""
    info = {
        "description": "",
        "author": "",
        "version": "?",
        "type": "misc",
        "scripts": [],
    }
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()
        info_el = root.find("info")
        if info_el is not None:
            info["description"] = info_el.get("description", "")
            info["author"]      = info_el.get("author", "")
            info["version"]     = info_el.get("version", "?")
            info["type"]        = info_el.get("type", "misc")
        for script in root.findall("script"):
            src = script.get("src", "")
            if src.endswith(".lua"):
                info["scripts"].append(src)
    except Exception:
        pass
    return info


def classify_resource(name, description, lua_data):
    """Classifica o tipo do resource e gera itens vendáveis."""
    lname = name.lower()
    ldesc = description.lower()
    all_text = lname + " " + ldesc

    # Junta todos os dados dos arquivos Lua
    all_cmds    = []
    all_tiers   = []
    all_setdata = []
    for lua in lua_data:
        all_cmds    += lua["commands"]
        all_tiers   += lua["vip_tiers"]
        all_setdata += lua["setData"]

    sellable = []
    category = "other"

    # ── VIP ────────────────────────────────────────────────────
    is_vip = any(k in all_text for k in VIP_KEYWORDS)
    if not is_vip:
        # Checa setElementData com "vip" nas chaves
        is_vip = any("vip" in k.lower() for k in all_setdata)

    if is_vip:
        category = "vip"
        # Tenta extrair tiers reais dos arquivos Lua
        real_tiers = []
        tier_kws = {
            "gold": "VIP Gold", "ouro": "VIP Ouro",
            "prata": "VIP Prata", "silver": "VIP Silver",
            "bronze": "VIP Bronze", "diamond": "VIP Diamond",
            "diamante": "VIP Diamante", "platina": "VIP Platina",
            "platinum": "VIP Platinum", "vip1": "VIP Nível 1",
            "vip2": "VIP Nível 2", "vip3": "VIP Nível 3",
            "premium": "VIP Premium", "doador": "VIP Doador",
        }

        # Procura tiers nos valores de tabelas Lua
        for tier_val in all_tiers:
            tv_lower = tier_val.lower()
            for kw, nice_name in tier_kws.items():
                if kw in tv_lower and nice_name not in [t["name"] for t in real_tiers]:
                    real_tiers.append({"name": nice_name, "tier_id": kw})

        # Procura tiers no nome do resource
        for kw, nice_name in tier_kws.items():
            if kw in lname and nice_name not in [t["name"] for t in real_tiers]:
                real_tiers.append({"name": nice_name, "tier_id": kw})

        if real_tiers:
            for t in real_tiers:
                sellable.append({
                    "suggestedName": t["name"],
                    "suggestedDesc": f"{t['name']} — benefícios exclusivos no servidor.",
                    "category":      "vip",
                    "mtaCommand":    "giveVip",
                    "mtaParams":     {"tier": t["tier_id"], "days": 30, "resource": name},
                    "autoDetected":  True,
                    "sourceFile":    name,
                })
        else:
            sellable.append({
                "suggestedName": f"VIP — {name}",
                "suggestedDesc": "Acesso VIP do servidor.",
                "category":      "vip",
                "mtaCommand":    "giveVip",
                "mtaParams":     {"resource": name, "days": 30},
                "autoDetected":  False,
                "sourceFile":    name,
            })

    # ── VEÍCULOS ───────────────────────────────────────────────
    elif any(k in all_text for k in VEHICLE_KEYWORDS):
        category = "vehicle"
        sellable.append({
            "suggestedName": f"Veículo — {name}",
            "suggestedDesc": "Veículo entregue no seu spawn.",
            "category":      "vehicle",
            "mtaCommand":    "giveVehicle",
            "mtaParams":     {"resource": name},
            "autoDetected":  False,
            "sourceFile":    name,
        })

    # ── MOEDAS ─────────────────────────────────────────────────
    elif any(k in all_text for k in COIN_KEYWORDS):
        category = "coins"
        for amt in [1000, 5000, 15000]:
            sellable.append({
                "suggestedName": f"{amt:,} Moedas".replace(",", "."),
                "suggestedDesc": f"Pacote de {amt:,} moedas.".replace(",", "."),
                "category":      "coins",
                "mtaCommand":    "giveCoins",
                "mtaParams":     {"amount": amt, "resource": name},
                "autoDetected":  False,
                "sourceFile":    name,
            })

    # ── ARMAS ──────────────────────────────────────────────────
    elif any(k in all_text for k in WEAPON_KEYWORDS):
        category = "weapon"
        for kit in ["starter", "premium"]:
            sellable.append({
                "suggestedName": f"Kit {kit.capitalize()}",
                "suggestedDesc": f"Kit de armas {kit}.",
                "category":      "item",
                "mtaCommand":    "giveWeaponKit",
                "mtaParams":     {"kit": kit, "resource": name},
                "autoDetected":  False,
                "sourceFile":    name,
            })

    return category, sellable, all_cmds


def scan_resources_folder(folder_path, progress_cb=None):
    """Escaneia a pasta resources e retorna todos os dados."""
    resources = []
    detected  = []

    items = [d for d in Path(folder_path).iterdir() if d.is_dir()]
    total = len(items)

    for idx, res_dir in enumerate(sorted(items)):
        name = res_dir.name

        if progress_cb:
            progress_cb(idx + 1, total, name)

        # Lê meta.xml
        meta_path = res_dir / "meta.xml"
        meta = parse_meta_xml(str(meta_path)) if meta_path.exists() else {
            "description": "", "author": "", "version": "?",
            "type": "misc", "scripts": [],
        }

        # Lê todos os .lua da pasta
        lua_data = []
        lua_files_found = []

        for lua_file in res_dir.glob("**/*.lua"):
            # Ignora subpastas muito profundas
            if len(lua_file.relative_to(res_dir).parts) > 3:
                continue
            parsed = parse_lua_file(str(lua_file))
            if parsed["raw_lines"] > 0:
                lua_data.append(parsed)
                lua_files_found.append(lua_file.name)

        # Classifica
        category, sellable, commands = classify_resource(
            name, meta["description"], lua_data
        )

        entry = {
            "name":        name,
            "description": meta["description"],
            "author":      meta["author"],
            "version":     meta["version"],
            "type":        meta["type"],
            "category":    category,
            "luaFiles":    lua_files_found,
            "commands":    list(set(commands)),
            "sellable":    sellable,
        }

        resources.append(entry)
        detected.extend(sellable)

    return resources, detected


# ── Interface Gráfica ───────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("900x680")
        self.minsize(700, 500)
        self.configure(bg="#0f1117")
        self.resizable(True, True)

        self.resources = []
        self.detected  = []
        self._load_config()
        self._build_ui()

    def _load_config(self):
        self.config_data = {"folder": "", "site_url": "", "token": ""}
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, "r") as f:
                    self.config_data = json.load(f)
        except Exception:
            pass

    def _save_config(self):
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump({
                    "folder":   self.var_folder.get(),
                    "site_url": self.var_url.get(),
                    "token":    self.var_token.get(),
                }, f)
        except Exception:
            pass

    def _build_ui(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame",       background="#0f1117")
        style.configure("TLabel",       background="#0f1117", foreground="#e2e8f0", font=("Segoe UI", 9))
        style.configure("TButton",      font=("Segoe UI", 9, "bold"), padding=6)
        style.configure("TEntry",       fieldbackground="#1e2130", foreground="#e2e8f0", insertcolor="#e2e8f0")
        style.configure("TLabelframe",  background="#0f1117", foreground="#64748b", font=("Segoe UI", 9))
        style.configure("TLabelframe.Label", background="#0f1117", foreground="#64748b")
        style.configure("Treeview",     background="#1e2130", foreground="#e2e8f0",
                         fieldbackground="#1e2130", rowheight=22)
        style.configure("Treeview.Heading", background="#1a1f2e", foreground="#94a3b8", font=("Segoe UI", 9, "bold"))
        style.map("Treeview", background=[("selected", "#3b4252")])
        style.configure("green.TButton",  background="#22c55e", foreground="white")
        style.configure("blue.TButton",   background="#3b82f6", foreground="white")
        style.configure("TProgressbar",   troughcolor="#1e2130", background="#3b82f6")

        # ── Header ──────────────────────────────────────────────
        header = tk.Frame(self, bg="#1e2130", pady=12)
        header.pack(fill="x")
        tk.Label(header, text="⚡ MTA Store Scanner", bg="#1e2130",
                 fg="#60a5fa", font=("Segoe UI", 14, "bold")).pack(side="left", padx=20)
        tk.Label(header, text="Analisa seus mods e envia pro site automaticamente",
                 bg="#1e2130", fg="#64748b", font=("Segoe UI", 9)).pack(side="left")

        # ── Config ──────────────────────────────────────────────
        cfg = ttk.LabelFrame(self, text=" Configuração ", padding=12)
        cfg.pack(fill="x", padx=16, pady=(12, 6))

        # Pasta resources
        row1 = ttk.Frame(cfg)
        row1.pack(fill="x", pady=3)
        ttk.Label(row1, text="Pasta Resources MTA:", width=22).pack(side="left")
        self.var_folder = tk.StringVar(value=self.config_data.get("folder", ""))
        ttk.Entry(row1, textvariable=self.var_folder, width=55).pack(side="left", padx=4)
        ttk.Button(row1, text="📁 Selecionar", command=self._browse_folder).pack(side="left")

        # URL do site
        row2 = ttk.Frame(cfg)
        row2.pack(fill="x", pady=3)
        ttk.Label(row2, text="URL do Site:", width=22).pack(side="left")
        self.var_url = tk.StringVar(value=self.config_data.get("site_url", ""))
        ttk.Entry(row2, textvariable=self.var_url, width=55).pack(side="left", padx=4)
        ttk.Label(row2, text="Ex: https://seusite.com", foreground="#64748b").pack(side="left")

        # Token
        row3 = ttk.Frame(cfg)
        row3.pack(fill="x", pady=3)
        ttk.Label(row3, text="Token MTA Store:", width=22).pack(side="left")
        self.var_token = tk.StringVar(value=self.config_data.get("token", ""))
        ttk.Entry(row3, textvariable=self.var_token, width=55, show="*").pack(side="left", padx=4)
        ttk.Label(row3, text="Mesmo token do config.lua", foreground="#64748b").pack(side="left")

        # ── Botões ──────────────────────────────────────────────
        btn_frame = tk.Frame(self, bg="#0f1117")
        btn_frame.pack(fill="x", padx=16, pady=6)

        self.btn_scan = ttk.Button(btn_frame, text="🔍 Escanear Pasta", command=self._start_scan, style="blue.TButton")
        self.btn_scan.pack(side="left", padx=(0, 8))

        self.btn_send = ttk.Button(btn_frame, text="🚀 Enviar pro Site", command=self._send_to_site,
                                    style="green.TButton", state="disabled")
        self.btn_send.pack(side="left", padx=(0, 8))

        self.btn_export = ttk.Button(btn_frame, text="💾 Exportar JSON", command=self._export_json, state="disabled")
        self.btn_export.pack(side="left")

        # Contador
        self.lbl_count = ttk.Label(btn_frame, text="", foreground="#64748b")
        self.lbl_count.pack(side="right")

        # ── Progress bar ────────────────────────────────────────
        self.progress = ttk.Progressbar(self, mode="determinate")
        self.progress.pack(fill="x", padx=16, pady=(0,4))
        self.lbl_status = ttk.Label(self, text="Pronto. Selecione a pasta e escaneie.", foreground="#64748b")
        self.lbl_status.pack(anchor="w", padx=16)

        # ── Tabela ──────────────────────────────────────────────
        tree_frame = ttk.LabelFrame(self, text=" Mods Detectados ", padding=6)
        tree_frame.pack(fill="both", expand=True, padx=16, pady=8)

        cols = ("mod", "categoria", "item", "comando", "auto")
        self.tree = ttk.Treeview(tree_frame, columns=cols, show="headings", height=14)

        self.tree.heading("mod",       text="Resource")
        self.tree.heading("categoria", text="Categoria")
        self.tree.heading("item",      text="Item detectado")
        self.tree.heading("comando",   text="Comando MTA")
        self.tree.heading("auto",      text="Auto")

        self.tree.column("mod",       width=180, minwidth=100)
        self.tree.column("categoria", width=90,  minwidth=70)
        self.tree.column("item",      width=240, minwidth=150)
        self.tree.column("comando",   width=150, minwidth=100)
        self.tree.column("auto",      width=60,  minwidth=50)

        sb = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscroll=sb.set)

        self.tree.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")

        # Tags de cor
        self.tree.tag_configure("vip",     foreground="#fbbf24")
        self.tree.tag_configure("vehicle", foreground="#60a5fa")
        self.tree.tag_configure("coins",   foreground="#34d399")
        self.tree.tag_configure("item",    foreground="#c084fc")
        self.tree.tag_configure("other",   foreground="#94a3b8")

        # ── Log ─────────────────────────────────────────────────
        log_frame = ttk.LabelFrame(self, text=" Log ", padding=4)
        log_frame.pack(fill="x", padx=16, pady=(0,12))

        self.log_box = scrolledtext.ScrolledText(
            log_frame, height=5, bg="#0a0d14", fg="#64748b",
            font=("Consolas", 8), state="disabled", wrap="word"
        )
        self.log_box.pack(fill="x")

    def _log(self, msg, color="#64748b"):
        ts  = datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {msg}\n"
        self.log_box.configure(state="normal")
        self.log_box.insert("end", line)
        self.log_box.configure(state="disabled")
        self.log_box.see("end")

    def _browse_folder(self):
        folder = filedialog.askdirectory(title="Selecione a pasta resources do MTA")
        if folder:
            self.var_folder.get()
            self.var_folder.set(folder)

    def _start_scan(self):
        folder = self.var_folder.get().strip()
        if not folder or not os.path.isdir(folder):
            messagebox.showerror("Erro", "Selecione uma pasta resources válida.")
            return
        self._save_config()
        self.btn_scan.configure(state="disabled")
        self.btn_send.configure(state="disabled")
        self.btn_export.configure(state="disabled")
        self.tree.delete(*self.tree.get_children())
        self.progress["value"] = 0
        threading.Thread(target=self._scan_thread, args=(folder,), daemon=True).start()

    def _scan_thread(self, folder):
        def progress_cb(done, total, name):
            self.progress["maximum"] = total
            self.progress["value"]   = done
            self.lbl_status.configure(text=f"Escaneando: {name} ({done}/{total})")
            self.update_idletasks()

        self._log(f"Iniciando scan em: {folder}")

        try:
            resources, detected = scan_resources_folder(folder, progress_cb)
            self.resources = resources
            self.detected  = detected
            self.after(0, self._scan_done)
        except Exception as e:
            self._log(f"ERRO: {e}")
            self.after(0, lambda: self.btn_scan.configure(state="normal"))

    def _scan_done(self):
        self.tree.delete(*self.tree.get_children())
        count = 0

        for res in self.resources:
            if not res["sellable"]:
                continue
            for item in res["sellable"]:
                cat   = item["category"]
                auto  = "✓" if item["autoDetected"] else ""
                tag   = cat if cat in ("vip","vehicle","coins","item") else "other"
                self.tree.insert("", "end", values=(
                    res["name"],
                    cat.upper(),
                    item["suggestedName"],
                    item["mtaCommand"],
                    auto,
                ), tags=(tag,))
                count += 1

        total_resources = len(self.resources)
        self._log(f"Scan concluído: {total_resources} resources, {count} item(ns) detectado(s).")
        self.lbl_status.configure(text=f"✅ Scan concluído — {count} item(ns) detectado(s) em {total_resources} resources.")
        self.lbl_count.configure(text=f"{count} item(ns) / {total_resources} resources")
        self.progress["value"] = self.progress["maximum"]
        self.btn_scan.configure(state="normal")

        if count > 0:
            self.btn_send.configure(state="normal")
            self.btn_export.configure(state="normal")

    def _send_to_site(self):
        url   = self.var_url.get().strip().rstrip("/")
        token = self.var_token.get().strip()

        if not url:
            messagebox.showerror("Erro", "Informe a URL do site.")
            return
        if not token:
            messagebox.showerror("Erro", "Informe o token.")
            return

        self.btn_send.configure(state="disabled")
        threading.Thread(target=self._send_thread, args=(url, token), daemon=True).start()

    def _send_thread(self, url, token):
        self._log(f"Enviando para {url}...")

        payload = json.dumps({
            "source":    "scanner_app",
            "trigger":   "MTA Scanner App",
            "total":     len(self.resources),
            "detected":  self.detected,
            "resources": self.resources,
            "scannedAt": int(__import__("time").time()),
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                url + "/api/mta/sync",
                data    = payload,
                headers = {
                    "Content-Type": "application/json",
                    "X-API-Token":  token,
                },
                method = "POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode())

            created = body.get("created", 0)
            skipped = body.get("skipped", 0)
            total   = body.get("total", len(self.detected))

            msg = f"✅ Enviado! {total} item(ns), {created} produto(s) criado(s), {skipped} já existiam."
            self._log(msg)
            self.after(0, lambda: messagebox.showinfo("Sucesso!", msg))
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            self._log(f"ERRO HTTP {e.code}: {body}")
            self.after(0, lambda: messagebox.showerror("Erro HTTP", f"Código {e.code}: {body[:200]}"))
        except Exception as e:
            self._log(f"ERRO: {e}")
            self.after(0, lambda: messagebox.showerror("Erro de conexão", str(e)))
        finally:
            self.after(0, lambda: self.btn_send.configure(state="normal"))

    def _export_json(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON", "*.json")],
            initialfile="mta_scan_result.json",
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump({
                    "resources": self.resources,
                    "detected":  self.detected,
                }, f, indent=2, ensure_ascii=False)
            self._log(f"Exportado: {path}")
            messagebox.showinfo("Exportado!", f"Arquivo salvo em:\n{path}")
        except Exception as e:
            messagebox.showerror("Erro", str(e))


# ── Entrypoint ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = App()
    app.mainloop()

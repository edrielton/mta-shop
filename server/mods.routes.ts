import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db"; // seu drizzle db
import { mods } from "@shared/schema"; // schema abaixo
import { eq } from "drizzle-orm";


const router = Router();

// Pasta onde os mods ficam armazenados no servidor
const MODS_DIR = path.join(process.cwd(), "uploads", "mods");
if (!fs.existsSync(MODS_DIR)) fs.mkdirSync(MODS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MODS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB por arquivo
});

// ─── Middleware de auth admin ──────────────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token ausente" });
  // reutiliza sua lógica JWT existente
  try {
    const jwt = require("jsonwebtoken");
    const payload = jwt.verify(token, process.env.SESSION_SECRET!);
    if (!(payload as any).isAdmin) return res.status(403).json({ error: "Acesso negado" });
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ─── GET /api/mods ─────────────────────────────────────────────────────────────
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const allMods = await db.select().from(mods).orderBy(mods.uploadedAt);
    res.json({ mods: allMods });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar mods" });
  }
});

// ─── POST /api/mods/upload ─────────────────────────────────────────────────────
router.post("/upload", requireAdmin, upload.array("files", 50), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const inserted = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const category = detectCategory(ext);

      // Upsert: se já existe pelo nome original, atualiza o arquivo
      const existing = await db
        .select()
        .from(mods)
        .where(eq(mods.originalName, file.originalname))
        .limit(1);

      if (existing.length > 0) {
        // Remove arquivo antigo
        try { fs.unlinkSync(path.join(MODS_DIR, existing[0].filename)); } catch {}
        const [updated] = await db
          .update(mods)
          .set({
            filename: file.filename,
            size: file.size,
            uploadedAt: new Date(),
          })
          .where(eq(mods.id, existing[0].id))
          .returning();
        inserted.push({ ...updated, action: "updated" });
      } else {
        const [newMod] = await db
          .insert(mods)
          .values({
            originalName: file.originalname,
            filename: file.filename,
            size: file.size,
            category,
            active: true,
          })
          .returning();
        inserted.push({ ...newMod, action: "created" });
      }
    }

    res.json({ success: true, uploaded: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao fazer upload" });
  }
});

// ─── PATCH /api/mods/:id/toggle ────────────────────────────────────────────────
router.patch("/:id/toggle", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await db.select().from(mods).where(eq(mods.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Mod não encontrado" });

    const [updated] = await db
      .update(mods)
      .set({ active: !existing[0].active })
      .where(eq(mods.id, id))
      .returning();

    res.json({ mod: updated });
  } catch {
    res.status(500).json({ error: "Erro ao alternar mod" });
  }
});

// ─── DELETE /api/mods/:id ──────────────────────────────────────────────────────
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await db.select().from(mods).where(eq(mods.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Mod não encontrado" });

    try { fs.unlinkSync(path.join(MODS_DIR, existing[0].filename)); } catch {}
    await db.delete(mods).where(eq(mods.id, id));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao deletar mod" });
  }
});

// ─── Utilitário ────────────────────────────────────────────────────────────────
function detectCategory(ext: string): string {
  const map: Record<string, string> = {
    ".dff": "modelo",
    ".txd": "textura",
    ".col": "colisão",
    ".ifp": "animação",
    ".lua": "script",
    ".zip": "pacote",
    ".rar": "pacote",
    ".img": "imagem",
    ".ide": "definição",
    ".ipl": "mapa",
  };
  return map[ext] || "outro";
}

export default router;

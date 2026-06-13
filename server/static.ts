import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve arquivos estáticos (JS, CSS, imagens, fontes)
  app.use(express.static(distPath, {
    maxAge: "1d",
    etag: true,
  }));

  // Todas as rotas (incluindo admin subdomain) servem o mesmo index.html
  // O React detecta window.location.hostname e renderiza o conteúdo correto
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

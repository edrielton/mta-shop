import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve arquivos estáticos (JS, CSS, imagens)
  app.use(express.static(distPath));

  // Todas as rotas → index.html (SPA)
  // O bloqueio por IP fica só nas rotas /api/admin/* no routes.ts
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

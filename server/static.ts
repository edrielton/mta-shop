import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { adminIpGuard } from "./adminGuard";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve arquivos estáticos (JS, CSS, imagens)
  app.use(express.static(distPath));

  // Rota /admin → protegida por IP, serve o mesmo index.html
  // (o React Router cuida de mostrar o componente certo)
  app.use("/admin*", adminIpGuard, (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // Todas as outras rotas → index.html (SPA)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

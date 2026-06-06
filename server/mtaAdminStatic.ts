import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

// Serve o panel.html do recurso mta-admin-panel via HTTP,
// para que o guiBrowser do MTA consiga renderizar (somente http/https).
export function serveMtaAdminPanelStatic(app: Express) {
  const panelPath = path.resolve(
    __dirname,
    "..",
    "mta-admin-panel",
    "panel.html"
  );

  if (!fs.existsSync(panelPath)) {
    throw new Error(`panel.html não encontrado em: ${panelPath}`);
  }

  const sendPanelHtml = (req: Request, res: Response) => {
    const html = fs.readFileSync(panelPath, "utf-8");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Content-Length", Buffer.byteLength(html).toString());

    // debug: também loga alguns headers e status
    console.log("[MTA-Admin Static] panel.html", {
      method: req.method,
      path: req.path,
      contentType: res.getHeader("Content-Type"),
      bytes: html.length,
      startsWith: html.slice(0, 60).replace(/\s+/g, " "),
    });

    res.status(200).send(html);
  };

  // url: /mta-admin-panel/panel.html
  app.get("/mta-admin-panel/panel.html", sendPanelHtml);

  // compat: sua rota no MTA é /admin
  app.get("/admin", sendPanelHtml);



}


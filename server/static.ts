import express, { type Express } from "express";
import fs from "fs";
import path from "path";
export function serveStatic(app: Express) {
  // The server is bundled to dist/index.cjs; start it from repo root.
  // If cwd is <repo>/dist, adjust accordingly.
  const repoRoot = (() => {
    const cwd = process.cwd();
    // Common cases:
    // - cwd == <repo>
    // - cwd == <repo>/dist
    if (fs.existsSync(path.join(cwd, "dist", "public"))) return cwd;
    if (fs.existsSync(path.join(cwd, "public"))) return cwd;
    if (fs.existsSync(path.join(cwd, "..", "dist", "public"))) return path.resolve(cwd, "..");
    return path.resolve(cwd, "..");
  })();

  const projectRoot = repoRoot;


  const distPath = path.resolve(projectRoot, "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}


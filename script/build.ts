import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// Módulos que serão bundlados pelo esbuild (inline no dist/index.cjs).
// Todos os outros deps vão para `external` e são carregados da node_modules.
// ATENÇÃO: NÃO adicione módulos com bindings nativos (.node) aqui —
// eles devem ficar em external para o Node carregar o binário correto.
const allowlist = [
  "@google/generative-ai",
  "axios",
  "compression",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "mercadopago",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));

  // Inclui optionalDependencies para que módulos nativos opcionais
  // (ex: bufferutil, utf-8-validate) também fiquem em external.
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
    alias: {
      "@shared": "./shared",
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
import type { NextConfig } from "next";

// Sem "output: standalone" de propósito: o caminho de deploy real é PM2 +
// "next start" direto no VPS (ver DEPLOY.md), não Docker. "standalone" só
// funciona com "node .next/standalone/server.js", não com "next start" — os
// dois modos são incompatíveis. O Dockerfile/docker-compose continuam no
// repo como alternativa não usada, mas o next.config.ts segue o modo padrão
// pra bater com o que o ecosystem.config.js (PM2) realmente roda.
const nextConfig: NextConfig = {};

export default nextConfig;

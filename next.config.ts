import type { NextConfig } from "next";

// Sem "output: standalone" de propósito: o caminho de deploy real é PM2 +
// "next start" direto no VPS (ver DEPLOY.md), não Docker. "standalone" só
// funciona com "node .next/standalone/server.js", não com "next start" — os
// dois modos são incompatíveis. O Dockerfile/docker-compose continuam no
// repo como alternativa não usada, mas o next.config.ts segue o modo padrão
// pra bater com o que o ecosystem.config.js (PM2) realmente roda.
const nextConfig: NextConfig = {
  // pdfkit/fontkit usam padrões (decorators via @swc/helpers) que o
  // bundler do Next (Turbopack) não consegue empacotar corretamente.
  // Como o deploy real roda com node_modules completo (PM2 + next start,
  // sem standalone), é seguro deixar esses pacotes de fora do bundle e
  // resolvê-los via require normal do Node em runtime.
  serverExternalPackages: ['pdfkit', 'fontkit'],
};

export default nextConfig;

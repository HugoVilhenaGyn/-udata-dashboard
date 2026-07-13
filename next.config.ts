import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" empacota só o necessário pra rodar em produção (server.js
  // + node_modules mínimos) — é o que o Dockerfile usa pra gerar uma imagem
  // enxuta pro deploy no VPS, em vez de copiar o repo inteiro + node_modules
  // completo pra dentro do container.
  output: 'standalone',
};

export default nextConfig;

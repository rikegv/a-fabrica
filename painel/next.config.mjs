/** @type {import('next').NextConfig} */
// Saida estatica: o Hosting do Firebase serve arquivos, nao servidor.
// A pasta publicada e painel/out. Todo dado e buscado no cliente, ao vivo.
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true }
};

export default nextConfig;

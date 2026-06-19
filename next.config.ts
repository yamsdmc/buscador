import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp = binaire natif : externe au bundle, inclus tel quel côté serveur.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;

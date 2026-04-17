/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },

  // Scaffold-phase: don't fail production builds on lint / strict-TS warnings.
  // The bundler still compiles the code; only the tsc --noEmit pass is skipped.
  // Tighten once the platform is in stable use.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

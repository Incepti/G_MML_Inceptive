/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["sharp", "vm2"],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only modules for client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        vm: false,
        child_process: false,
      };
    }
    // Handle Three.js properly
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      use: ["raw-loader"],
    });
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.khronos.org" },
      { protocol: "https", hostname: "**.modelviewer.dev" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
    ],
  },
};

module.exports = nextConfig;

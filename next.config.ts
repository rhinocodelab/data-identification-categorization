import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Provide fallbacks for Node.js modules that are not available in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
      
      // Force Konva to use the browser version instead of the Node.js version
      config.resolve.alias = {
        ...config.resolve.alias,
        'konva/lib/index-node.js': 'konva/lib/index.js',
      };
    }
    return config;
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode to reduce CPU usage (causes double renders)
  reactStrictMode: false,
  // Remove standalone mode - it's causing issues with static file serving
  // output: 'standalone',
  // Optimize for production
  swcMinify: true,
  // Disable source maps in production to reduce overhead
  productionBrowserSourceMaps: false,
  // Disable file watching in production (shouldn't be needed but ensure it's off)
  webpack: (config, { dev, isServer }) => {
    if (!dev && isServer) {
      // Disable file watching in production
      config.watchOptions = {
        ignored: ['**/*'],
      }
    }
    return config
  },
  // Disable experimental features that might cause overhead
  experimental: {
    // Disable any experimental features
  },
}

module.exports = nextConfig


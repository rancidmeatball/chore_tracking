/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode to reduce CPU usage (causes double renders)
  reactStrictMode: false,
  // Enable standalone mode - this is required for proper Docker deployment
  output: 'standalone',
  // Optimize for production
  swcMinify: true,
  // Disable source maps in production to reduce overhead
  productionBrowserSourceMaps: false,
  // Ensure trailing slash is handled correctly
  trailingSlash: false,
  // Disable file watching in production (shouldn't be needed but ensure it's off)
  webpack: (config, { dev, isServer }) => {
    // Only modify config if not in dev mode
    if (!dev) {
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
  // Ensure routes are properly resolved
  // This might help with route resolution in production
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
}

module.exports = nextConfig


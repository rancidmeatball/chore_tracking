/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode to reduce CPU usage (causes double renders)
  reactStrictMode: false,
  // Disable standalone mode - build is not creating standalone directory
  // Using next start instead of standalone server
  // output: 'standalone',
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
  // Ensure Next.js can find the app directory
  // This might help with app router file resolution
  distDir: '.next',
}

module.exports = nextConfig


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
}

module.exports = nextConfig


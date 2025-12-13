/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove standalone mode - it's causing issues with static file serving
  // output: 'standalone',
  // Ensure CSS is properly handled
  experimental: {
    optimizeCss: false, // Disable CSS optimization to avoid issues
  },
}

module.exports = nextConfig


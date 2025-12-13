/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove standalone mode - it's causing issues with static file serving
  // output: 'standalone',
  // Ensure static files are served correctly
  assetPrefix: undefined,
  basePath: '',
}

module.exports = nextConfig


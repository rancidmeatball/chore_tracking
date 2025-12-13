/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove standalone mode - it's causing issues with static file serving
  // output: 'standalone',
}

module.exports = nextConfig


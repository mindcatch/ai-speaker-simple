import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Enable experimental features if needed
    serverActions: {
      bodySizeLimit: '100mb'
    }
  },
  // Allow Next.js to automatically find available port
  // This will be handled by the start script
}

export default nextConfig

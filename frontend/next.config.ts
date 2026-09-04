/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow tunnel/proxy services (zrok, ngrok, etc.) to access the dev server.
  // Next.js 15+ validates the Host header and returns a raw "Unauthorized"
  // string for unknown hosts, which breaks reverse proxies expecting HTTP.
  devIndicators: false,
  allowedDevOrigins: [
    'vw5izkdjk7p5.shares.zrok.io',
    'nbuimbnbcdwy.shares.zrok.io',
    '*.shares.zrok.io',
    '*.share.zrok.io',
    '*.zrok.io',
    '*.ngrok-free.app',
    '*.loca.lt',
    'localhost:3000',
    '127.0.0.1:3000',
  ],

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://localhost:8000/health',
      },
      // Proxy WebSocket through Next.js so wss://tunnel-host/ws/events works
      // without mixed-content errors when accessed via zrok/cloudflare HTTPS tunnel
      {
        source: '/ws/:path*',
        destination: 'http://localhost:8000/ws/:path*',
      },
    ]
  },
}

export default nextConfig

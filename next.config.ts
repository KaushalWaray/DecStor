import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    // This rewrite is only for local development to proxy API requests to the backend server.
    // In production, the full backend URL will be used from the environment variable.
    if (process.env.NODE_ENV === 'development') {
        return [
          {
            source: '/api/:path*',
            destination: 'http://127.0.0.1:3001/api/:path*',
          },
        ]
    }
    return [];
  },
};

export default nextConfig;

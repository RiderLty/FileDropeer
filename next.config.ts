import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // basePath: '/FileDropeer',
  basePath: process.env.PWD === "/home/user/studio" ? "" : "/FileDropeer",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

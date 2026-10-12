/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: '/index.html',
        destination: '/',
        permanent: true,
      },
      {
        source: '/inventory.html',
        destination: '/inventory/',
        permanent: true,
      },
      {
        source: '/inventory/index.html',
        destination: '/inventory/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

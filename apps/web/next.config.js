/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com', 'api.telegram.org', 'via.placeholder.com'],
  },
};

module.exports = nextConfig;

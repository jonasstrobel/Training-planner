/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: {
    position: "bottom-right"
  },
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }
  }
};

export default nextConfig;

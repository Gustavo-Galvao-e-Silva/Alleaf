/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@xenova/transformers'],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },
  // Remove the experimental.turbopack section entirely
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    experimental: {
        serverActions: {
            allowedOrigins: ["*"]
        }
    },
    serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;

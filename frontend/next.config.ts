import type { NextConfig } from "next";

// Local dev: the browser calls relative /api/* only; Next.js forwards it to FastAPI (AD-2).
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }];
  },
};

export default nextConfig;

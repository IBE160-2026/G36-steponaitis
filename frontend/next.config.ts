import type { NextConfig } from "next";

// Local dev: the browser calls relative /api/* only; Next.js forwards it to FastAPI (AD-2).
// On Vercel (VERCEL set) the Services rewrite in vercel.json owns /api, so no rewrite here.
const nextConfig: NextConfig = {
  // Move list's route is `print` (Story 8.3); its old URL redirects there. Any other unknown step has
  // no route, so Next answers 404 before rendering: a page-level notFound() would not set the
  // status, because the page guard (Story 9.2) renders nothing on the server.
  async redirects() {
    return [{ source: "/plans/:planId/move-list", destination: "/plans/:planId/print", permanent: false }];
  },
  async rewrites() {
    if (process.env.VERCEL) return [];
    return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }];
  },
};

export default nextConfig;

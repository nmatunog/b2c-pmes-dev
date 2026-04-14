import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * OpenNext Worker: Edge API routes + Next shell (see `app/page.jsx`). Production member/marketing UI is the
 * **Vite** app (`npm run vite:build` → `dist/`), deployed to **Cloudflare Pages** — not bundled here.
 * Do **not** add catch-all rewrites to `/index.html` expecting the Vite bundle: those assets are not in
 * `.open-next/assets` unless you copy `dist` into the deploy pipeline. Point `b2ccoop.com` at the Pages
 * project; keep this Worker for `/api/*` (or a `*.workers.dev` host).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Same URL path as Nest (`POST /auth/sync-member`) so the Vite client does not need changes. */
  async rewrites() {
    return [
      { source: "/ai/landing-chat", destination: "/api/ai/landing-chat" },
      { source: "/auth/sync-member", destination: "/api/auth/sync-member" },
      { source: "/health", destination: "/api/health" },
      { source: "/pmes/submit", destination: "/api/pmes/submit" },
      { source: "/pmes/loi", destination: "/api/pmes/loi" },
      { source: "/pmes/certificate", destination: "/api/pmes/certificate" },
      { source: "/pmes/membership-lifecycle", destination: "/api/pmes/membership-lifecycle" },
      { source: "/pmes/member/resolve-login-email", destination: "/api/pmes/member/resolve-login-email" },
      { source: "/pmes/member/callsign", destination: "/api/pmes/member/callsign" },
      { source: "/pmes/pioneer/check-eligibility", destination: "/api/pmes/pioneer/check-eligibility" },
    ];
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;

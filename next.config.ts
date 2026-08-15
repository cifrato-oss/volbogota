import type { NextConfig } from "next";

/**
 * `standalone` only when asked for, never by default.
 *
 * A container needs `output: "standalone"` — it bundles the server and just the
 * dependencies it uses, so the image does not carry `node_modules` whole. But
 * App Hosting builds this same repo through its own Next adapter, and changing
 * the output shape under it is not something to try on a backend that is serving
 * a live event.
 *
 * So the Dockerfile sets `BUILD_STANDALONE=true` and App Hosting keeps building
 * exactly what it built before.
 */
const nextConfig: NextConfig = {
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" as const } : {}),

  // The volunteer flow moved from /voluntario + /centros/[id] to /voluntarios +
  // /voluntarios/[id] (so the "Ser voluntario" nav link stays active on the
  // detail, mirroring /donar). Keep the old URLs working for existing links.
  async redirects() {
    return [
      { source: "/voluntario", destination: "/voluntarios", permanent: true },
      { source: "/centros", destination: "/voluntarios", permanent: true },
      { source: "/centros/:id", destination: "/voluntarios/:id", permanent: true },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

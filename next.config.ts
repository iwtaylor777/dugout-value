import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Retitled articles keep their old links working.
  async redirects() {
    return [
      {
        source: "/analysis/disciplined-hitters-edge-on-elite-arms-failed-its-holdout",
        destination: "/analysis/do-good-swing-decisions-beat-elite-relievers",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

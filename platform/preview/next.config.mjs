export default {
  output: "standalone",
  experimental: {
    outputFileTracingRoot: new URL("..", import.meta.url).pathname,
  },
  transpilePackages: ["@plasmic-shared/preview"],
  poweredByHeader: false,
  // Published user code is rendered only in the browser, never in the Node process.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

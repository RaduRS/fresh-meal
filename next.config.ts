import type { NextConfig } from "next";

import nextPWA from "next-pwa";

type WorkboxContext = {
  request: {
    destination: string;
    mode: string;
  };
  url: {
    pathname: string;
  };
};

const withPWA = nextPWA({
  dest: "public",
  disable: process.env.NODE_ENV !== "production",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }: WorkboxContext) =>
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "worker",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-resources",
      },
    },
    {
      urlPattern: ({ request }: WorkboxContext) =>
        request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 60 * 60 * 24 * 14,
        },
      },
    },
    {
      urlPattern: ({ url }: WorkboxContext) =>
        url.pathname.startsWith("/api/") || url.pathname.startsWith("/rest/"),
      handler: "NetworkFirst",
      options: {
        cacheName: "api",
        networkTimeoutSeconds: 6,
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 60 * 60,
        },
      },
    },
    {
      urlPattern: ({ request }: WorkboxContext) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 6,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 * 6,
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {};

export default withPWA(nextConfig);

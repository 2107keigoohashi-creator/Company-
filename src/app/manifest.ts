import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CALLOUT HQ",
    short_name: "CALLOUT HQ",
    description: "AI社員と回す CALLOUT 運営会社の経営管理アプリ",
    start_url: "/tasks",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090c12",
    theme_color: "#090c12",
    lang: "ja",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}

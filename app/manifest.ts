import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tagsheep",
    short_name: "Tagsheep",
    description: "A community-built clothing tag database for thrifters, resellers, and vintage hunters.",
    start_url: "/",
    display: "standalone",
    background_color: "#090f1c",
    theme_color: "#0f172a",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

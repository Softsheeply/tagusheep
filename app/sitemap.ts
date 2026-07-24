import { MetadataRoute } from "next";

const BASE_URL = "https://tagsheep.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/tags", "/upload", "/submit-info"];

    return staticRoutes.map((route) => ({
        url: `${BASE_URL}${route}`,
            lastModified: new Date(),
              }));
              }
              

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://handicappin.com";

  const SITE_LAST_MAJOR_UPDATE = new Date("2026-02-09"); // Update when content changes

  return [
    {
      url: baseUrl,
      lastModified: SITE_LAST_MAJOR_UPDATE,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: SITE_LAST_MAJOR_UPDATE,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: SITE_LAST_MAJOR_UPDATE,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: SITE_LAST_MAJOR_UPDATE,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: SITE_LAST_MAJOR_UPDATE,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}

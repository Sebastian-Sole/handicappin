import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/contact"],
        disallow: [
          "/api/",
          "/dashboard/",
          "/profile/",
          "/rounds/",
          "/calculators/",
          "/onboarding/",
          "/upgrade/",
          "/billing/",
          "/login/",
          "/signup/",
          "/forgot-password/",
          "/update-password/",
          "/verify-email/",
          "/verify-signup/",
          "/auth/",
        ],
      },
    ],
    sitemap: "https://handicappin.com/sitemap.xml",
  };
}

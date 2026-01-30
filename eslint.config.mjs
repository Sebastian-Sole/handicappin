import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    // React Email templates need raw apostrophes for email client compatibility
    files: ["emails/**/*.tsx", "supabase/functions/**/*.tsx"],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;

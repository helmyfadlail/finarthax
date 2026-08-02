import { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { loadEncryptedEnv } from "./scripts/load-encrypted-env";

loadEncryptedEnv();

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);

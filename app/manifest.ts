import type { MetadataRoute } from "next";

const appName = process.env.APP_NAME || "Daily Dose Supplements";
const appShortName = process.env.APP_SHORT_NAME || "Daily Dose";
const appDescription =
  process.env.APP_DESCRIPTION || "نظام إدارة متجر Daily Dose Supplements";
const themeColor = process.env.APP_THEME_COLOR || "#302cb7";

const icon192 = process.env.APP_ICON_192_URL || "/icons/icon-192.png";
const icon512 = process.env.APP_ICON_512_URL || "/icons/icon-512.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: appName,
    short_name: appShortName,
    description: appDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f5",
    theme_color: themeColor,
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    icons: [
      {
        src: icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { LanguageProvider } from "@/components/LanguageProvider";
import { RoleProvider } from "@/components/RoleProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

const appName = process.env.APP_NAME || "Daily Dose Supplements";
const appShortName = process.env.APP_SHORT_NAME || "Daily Dose";
const appDescription =
  process.env.APP_DESCRIPTION || "نظام إدارة متجر Daily Dose Supplements";
const appThemeColor = process.env.APP_THEME_COLOR || "#302cb7";

const icon192 = process.env.APP_ICON_192_URL || "/icons/icon-192.png";
const icon512 = process.env.APP_ICON_512_URL || "/icons/icon-512.png";
const appleIcon = process.env.APP_APPLE_ICON_URL || icon192;

export const metadata: Metadata = {
  title: appName,
  description: appDescription,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: icon192,
    apple: appleIcon,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appShortName,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: appThemeColor,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <RoleProvider>
              <AuthGate>{children}</AuthGate>
              <ServiceWorkerRegister />
            </RoleProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { LanguageProvider } from "@/components/LanguageProvider";
import { RoleProvider } from "@/components/RoleProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { brand, brandCssVars } from "@/lib/brand";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.description,
  manifest: brand.manifest,
  icons: {
    icon: brand.icon192,
    apple: brand.icon192,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: brand.shortName,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: brand.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" style={brandCssVars() as React.CSSProperties}>
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

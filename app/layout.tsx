import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CoCare",
    template: "%s | CoCare",
  },
  description: "Derick's co-parenting care calendar",
  applicationName: "CoCare",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CoCare",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "32x32" },
      { url: "/icons/cocare-icon.svg?v=3", type: "image/svg+xml" },
      { url: "/icons/cocare-icon-192.png?v=3", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/cocare-icon-192.png?v=3",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

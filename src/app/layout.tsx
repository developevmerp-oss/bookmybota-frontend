import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import RootLayoutClient from "./RootLayoutClient";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

/** Bump this when replacing favicon files so browsers drop stale cache. */
const FAVICON_V = "20260923";

export const metadata: Metadata = {
  title: {
    default: "Book My Bota",
    template: "%s | Book My Bota",
  },
  description:
    "Discover and book tables, events, movies, and more with Book My Bota.",
  applicationName: "Book My Bota",
  icons: {
    icon: [
      { url: `/favicon.ico?v=${FAVICON_V}`, sizes: "any" },
      {
        url: `/favicon-16x16.png?v=${FAVICON_V}`,
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: `/favicon-32x32.png?v=${FAVICON_V}`,
        sizes: "32x32",
        type: "image/png",
      },
      { url: `/favicon.png?v=${FAVICON_V}`, type: "image/png" },
      { url: `/icon.png?v=${FAVICON_V}`, type: "image/png" },
    ],
    shortcut: `/favicon.ico?v=${FAVICON_V}`,
    apple: [
      {
        url: `/apple-icon.png?v=${FAVICON_V}`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="customer-theme" suppressHydrationWarning>
      <head>
        <link rel="icon" href={`/favicon.ico?v=${FAVICON_V}`} sizes="any" />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={`/favicon-16x16.png?v=${FAVICON_V}`}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={`/favicon-32x32.png?v=${FAVICON_V}`}
        />
        <link rel="icon" type="image/png" href={`/favicon.png?v=${FAVICON_V}`} />
        <link rel="apple-touch-icon" href={`/apple-icon.png?v=${FAVICON_V}`} />
        <link rel="shortcut icon" href={`/favicon.ico?v=${FAVICON_V}`} />
      </head>
      <body className={`${manrope.className} ${manrope.variable}`}>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ReactNode } from "react";
import { Toaster } from "@/components/Toaster";
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : "http://localhost:3000";

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: "The Hub",
    description: "The Hub web application",
    openGraph: {
        title: "The Hub",
        description: "The Hub web application",
        images: [
            {
                url: "/web-app-manifest-512x512.png",
                width: 512,
                height: 512,
                alt: "The Hub",
            },
        ],
    },
    twitter: {
        card: "summary",
        title: "The Hub",
        description: "The Hub web application",
        images: ["/web-app-manifest-512x512.png"],
    },
};

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
`;

const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "The Hub",
    url: siteUrl,
    logo: `${siteUrl}/web-app-manifest-512x512.png`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
                />
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground min-h-dvh overflow-x-hidden antialiased`}
            >
                {children}
                <Toaster />
                <SpeedInsights />
            </body>
        </html>
    );
}

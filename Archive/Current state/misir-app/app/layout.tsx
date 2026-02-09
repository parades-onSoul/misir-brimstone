import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const interVariable = localFont({
  src: [
    {
      path: "../public/fonts/InterVariable.woff2",
      style: "normal",
    },
    {
      path: "../public/fonts/InterVariable-Italic.woff2",
      style: "italic",
    },
  ],
  variable: "--font-regular",
  display: "swap",
  weight: "300 700",
});

const monoFont = localFont({
  src: "../public/fonts/MonoVariable.woff2",
  variable: "--font-monospace",
  display: "swap",
  weight: "300 700",
});

export const metadata: Metadata = {
  title: "Misir - Personal Orientation System",
  description: "Understand where you stand in your information world",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${interVariable.variable} ${monoFont.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

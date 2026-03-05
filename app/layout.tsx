import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GEEZ MML Studio",
  description:
    "Production-ready MML Alpha editor with AI generation, Three.js preview, and strict validation.",
  keywords: ["MML", "3D", "WebXR", "editor", "AI", "Three.js"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-editor-bg text-editor-text overflow-hidden h-screen font-sans">
        {children}
      </body>
    </html>
  );
}

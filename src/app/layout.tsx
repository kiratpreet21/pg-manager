import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PG Manager — Girls PG Accommodation",
  description: "Property and billing management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

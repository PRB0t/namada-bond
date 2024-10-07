import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // Custom CSS variable for Inter font
});

export const metadata: Metadata = {
  title: "Everlasting Bonds",
  description:
    "Create your pre-bond transaction to be included in the Namada Genesis Block.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}

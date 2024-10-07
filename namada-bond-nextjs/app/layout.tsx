import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}

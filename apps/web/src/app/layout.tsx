import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "LMS Coach MVP",
  description: "Local LMS MVP for coaching centers"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

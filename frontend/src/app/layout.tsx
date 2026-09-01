import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Razorpay | Revenue Recovery Console",
  description:
    "Project Re-Collect — AI-powered multi-agent revenue recovery. Detects at-risk payments, diagnoses root cause, runs compliant recovery workflows, and proves results with a live money-recovered counter.",
  keywords: ["revenue recovery", "AI collections", "Razorpay", "payment recovery", "multi-agent"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Inter + JetBrains Mono */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Material Symbols Outlined — variable axes */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[#F7F9FB] text-[#191C1E]">
        {children}
      </body>
    </html>
  );
}

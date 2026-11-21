import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Smart Warehouse Planner",
  description: "Plan where parts should be stored in the warehouse.",
};

// Fonts are self-hosted via @fontsource in Story 1.4; never next/font/google (NFR-2).
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

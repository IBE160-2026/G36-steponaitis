import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "@fontsource/barlow-semi-condensed/700.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/common/app-shell";
import { AuthGuard } from "@/modules/auth/auth-guard";
import { UserMenu } from "@/modules/auth/user-menu";
import { Launcher } from "@/modules/launcher/launcher";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Smart Warehouse Planner",
  description: "Plan where parts should be stored in the warehouse.",
};

// Fonts are self-hosted from the @fontsource packages above; no font is fetched from a CDN (NFR-2).
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* With FEATURE_AUTH on, pages other than Log in and Create account need a session (Story 9.2). */}
          <AuthGuard>
            <AppShell launcher={<Launcher />} account={<UserMenu />}>
              {children}
            </AppShell>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}

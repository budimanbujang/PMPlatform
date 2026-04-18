import type { Metadata } from "next";
import { Toaster } from "sonner";
import { displayFont, sansFont } from "@/lib/fonts";
import { ThemeInit } from "@/components/theme/theme-init";
import { GooFilterDefs } from "@/components/ui/goo-filter";
import "./globals.css";

export const metadata: Metadata = {
  title: "JCorp PMPlatform",
  description:
    "Source of truth for every project running in JCorp HoldCo — reporting, governance, insights.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${displayFont.variable} ${sansFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInit />
      </head>
      <body className="h-full bg-bg-subtle text-fg1 font-sans">
        <GooFilterDefs />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "!font-sans !text-[13px]",
            },
          }}
        />
      </body>
    </html>
  );
}

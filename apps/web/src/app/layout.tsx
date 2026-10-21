import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AppToaster } from "@/components/app-toaster";
import { QueryProvider } from "@/components/query-provider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppI18nProvider } from "@/components/i18n/app-i18n-provider";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "BA Helper | Requirement-to-Code Impact Analyzer",
  description: "Evidence-backed requirement-to-code impact analysis for technical BA and QA review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              <Suspense fallback={null}>
                <AppI18nProvider>
                  <TooltipProvider>
                    {children}
                    <AppToaster />
                  </TooltipProvider>
                </AppI18nProvider>
              </Suspense>
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

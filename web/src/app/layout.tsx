import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "ArcLaunch · Launch tokens on Arc, settled in USDC",
  description:
    "Zero-cost token launches on Arc. Every trade priced in USDC, LP locked forever, creators earn 75% of fees automatically.",
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before paint so the persisted theme never flashes. `?theme=` / `?lang=` override and persist.
const themeScript = `(function(){try{var q=new URLSearchParams(location.search);var qt=q.get('theme');var ql=q.get('lang');if(qt==='terminal'||qt==='arc'){localStorage.setItem('arclaunch.theme',qt);}if(ql==='zh'||ql==='en'){localStorage.setItem('arclaunch.locale',ql);}var t=localStorage.getItem('arclaunch.theme');if(t==='terminal'||t==='arc'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Both brand themes are dark; the `dark` class keeps shadcn's dark variants active.
  return (
    <html lang="zh-CN" data-theme="arc" className="dark font-sans" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <AppProviders>
          <AppShell>{children}</AppShell>
          <Toaster position="top-center" />
        </AppProviders>
      </body>
    </html>
  );
}

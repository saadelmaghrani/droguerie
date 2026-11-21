import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s · Administration", default: "Administration" },
  // L'espace admin ne doit jamais apparaître dans Google.
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full flex-1 bg-slate-50 text-slate-900">{children}</div>;
}

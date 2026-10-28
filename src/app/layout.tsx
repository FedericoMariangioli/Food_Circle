import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FoodCircle — mangiare bene, insieme",
  description:
    "Il tuo spazio per il diario alimentare, le ricette e una community che condivide con consapevolezza.",
  applicationName: "FoodCircle",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

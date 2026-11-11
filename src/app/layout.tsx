import type { Metadata } from "next";
import { Header, Footer } from "@/components/common";
import "./globals.css";
export const metadata: Metadata = {
  title: "SpikeSlot — Catch a good moment",
  description:
    "Find a rising creator. Make a sponsorship that belongs. A PayPal AI hackathon demo.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

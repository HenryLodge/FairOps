import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FairOps",
  description:
    "The modern way to manage vendor operations, booth assignments, and event logistics for fairs and carnivals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Auth0Provider>
          <WalletProvider>{children}</WalletProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}

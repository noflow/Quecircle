import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CineCircle — Trusted movie recommendations", description: "Discover, share, and rate movie and TV recommendations with the people who know your taste." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }

import type { Metadata } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const sans = Hanken_Grotesk({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
});

const serif = Newsreader({
    subsets: ["latin"],
    style: ["normal", "italic"],
    variable: "--font-serif",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Document Q&A",
    description:
        "Ask questions about your documents and see the pages every answer came from.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={`${sans.variable} ${serif.variable}`}>
            <body>{children}</body>
        </html>
    );
}
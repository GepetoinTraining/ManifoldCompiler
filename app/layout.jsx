import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "MM Compiler",
  description: "A compiler that adds zero bytes. Everything is earned through barcodes.",
  icons: { icon: "/icon.png" },
  openGraph: {
    title: "MM Compiler",
    description: "Proves it adds nothing. Everything earned through barcodes.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MM Compiler",
    description: "Proves it adds nothing. Everything earned through barcodes.",
    images: ["/og-image.png"],
  },
  other: { "theme-color": "#06060a" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#06060a" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <nav className="nav">
          <div>
            <Link href="/" className="nav-brand-name">
              <span className="nav-icon">⬡</span> MM Compiler
            </Link>
            <div className="nav-brand-sub">proves it adds nothing</div>
          </div>
          <div className="nav-links">
            <Link href="/" className="nav-link">Verifier</Link>
            <Link href="/about" className="nav-link">About</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "MM Compiler Verifier — Proves It Adds Nothing",
  description:
    "A transparency tool that scans QR codes and barcodes, crystallizes their content, and provides a full audit trail proving zero bytes are injected, modified, or fabricated.",
  keywords: ["QR code", "barcode", "verifier", "audit", "transparency", "compiler"],
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    title: "MM Compiler Verifier",
    description: "Proves it adds nothing. Scan QR codes, crystallize content, audit every byte.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MM Compiler Verifier",
    description: "Proves it adds nothing. Scan QR codes, crystallize content, audit every byte.",
    images: ["/og-image.png"],
  },
  other: {
    "theme-color": "#06060a",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#06060a" />
        <link rel="icon" href="/icon.png" type="image/png" />
      </head>
      <body>
        <nav className="nav">
          <div className="nav-brand">
            <Link href="/" className="nav-brand-name">
              <span className="nav-icon">⬡</span> MM Compiler
            </Link>
            <span className="nav-brand-sub">proves it adds nothing</span>
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

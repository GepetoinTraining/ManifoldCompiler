import "./globals.css";
import Nav from "./components/Nav";

export const metadata = {
  title: "Manifold Compiler",
  description: "LLM memory done right. Persistent memory through pure geometry.",
  icons: { icon: "/icon.png" },
  openGraph: {
    title: "Manifold Compiler",
    description: "LLM memory done right. No vectors. No embeddings. Pure geometry.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Manifold Compiler",
    description: "LLM memory done right. No vectors. No embeddings. Pure geometry.",
    images: ["/og-image.png"],
  },
  other: { "theme-color": "#050510" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#050510" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}

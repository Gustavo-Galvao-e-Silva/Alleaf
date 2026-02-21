import "./globals.css";

export const metadata = {
  title: "Alleaf — Your Wellness Space",
  description: "A calm, personal wellness companion for breathing, mindfulness, and gratitude.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

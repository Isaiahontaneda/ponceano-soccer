import { Geist } from "next/font/google";
import "@/frontend/estilos/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Ponceano Soccer",
    template: "%s — Ponceano Soccer",
  },
  description: "Sistema de reservas y administración de la cancha sintética Ponceano Soccer.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}

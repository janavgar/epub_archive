import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPUB Archive — Gestión & Clasificación con IA Local",
  description: "Plataforma web para gestionar, clasificar, buscar semánticamente y agrupar colecciones de libros EPUB con modelos locales.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased min-h-screen bg-[#08090d] text-slate-100">
        {children}
      </body>
    </html>
  );
}

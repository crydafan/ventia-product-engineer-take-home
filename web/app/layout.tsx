import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "VentIA | Prueba Product Engineer",
  description: "Espacio de trabajo de la prueba Product Engineer",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}

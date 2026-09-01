import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Inglaterra",
  description: "Sistema central de gestão do catálogo imobiliário do Grupo Inglaterra.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

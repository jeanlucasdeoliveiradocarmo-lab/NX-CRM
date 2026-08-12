import "./globals.css";

export const metadata = {
  title: "NX CRM",
  description: "CRM simples com Next.js, Firebase e Tailwind CSS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

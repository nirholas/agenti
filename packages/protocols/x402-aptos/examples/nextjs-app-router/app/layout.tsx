import { WalletProvider } from "../components/WalletProvider";
import "./globals.css";

export const metadata = {
  title: "x402a - Real Blockchain Payments",
  description: "HTTP 402 Payment Required with Aptos blockchain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-950 text-stone-100 min-h-screen">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}

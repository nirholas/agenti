import './globals.css'

export const metadata = {
  title: 'A2A x402 Payment Client',
  description: 'Client for A2A protocol with x402 payment extension using Crossmint',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'agenti dashboard',
  description: 'Real-time AI agent activity visualization',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0f172a' }}>{children}</body>
    </html>
  )
}

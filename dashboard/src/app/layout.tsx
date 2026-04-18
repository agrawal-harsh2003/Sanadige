import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sanadige Staff',
  description: 'Internal staff dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-[#1a2e1a] antialiased">{children}</body>
    </html>
  )
}

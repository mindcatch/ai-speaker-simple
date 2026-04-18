import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Academic Presentation AI Coach',
  description: 'AI-powered presentation coaching platform for academic researchers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  )
}

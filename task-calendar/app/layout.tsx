import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Task Calendar - Chore Tracker',
  description: 'Track chores and tasks for children with Home Assistant integration',
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


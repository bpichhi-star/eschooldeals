import './globals.css'

export const metadata = {
  title: 'eSchoolDeals — Deals for Students & Everyone',
  description: 'The best deals on electronics, dorm essentials, textbooks, tech, and more. Updated automatically every hour.',
  keywords: 'student deals, college deals, electronics deals, back to school, discount, coupon',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

import './globals.css'

export const metadata = {
  title: 'eSchoolDeals — Deals for Students & Everyone',
  description: 'The best deals on electronics, dorm essentials, textbooks, tech, and more. Updated automatically every hour.',
  keywords: 'student deals, college deals, electronics deals, back to school, discount, coupon',
  verification: {
    other: {
      'impact-site-verification': 'a5ad4f73-2a3a-4048-8eef-e2c615436885',
    },
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="impact-site-verification" value="a5ad4f73-2a3a-4048-8eef-e2c615436885" />
      </head>
      <body>{children}</body>
    </html>
  )
}

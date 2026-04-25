// lib/feeds/amazon.js
// Amazon deals are added MANUALLY via /admin using SiteStripe affiliate links.
// Associate tag: eschooldeal0a-20  (set AMAZON_ASSOCIATE_TAG in Vercel)
//
// How to add a deal:
//   1. Visit any Amazon product page while logged into Associates Central
//   2. Use the SiteStripe bar at the top -> Get Link -> Short URL
//   3. Go to /admin and paste the SiteStripe URL as product_url
//
// Automated fetch disabled until 10 affiliate sales are reached.

export const AMAZON_ASSOCIATE_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'eschooldeal0a-20';

export async function fetchAmazonDeals() {
  console.log('[amazon] automated fetch disabled — add deals manually via /admin + SiteStripe');
  return [];
}

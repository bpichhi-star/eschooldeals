// app/page.jsx
'use client'; // This is a Client Component because it uses useState

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';

// This function now runs on the SERVER to fetch the data
async function getDeals() {
  // Use a public Cloudflare proxy to bypass the 403 error from eDealInfo
  const proxyUrl = 'https://rss-proxy.letscorp.net/?target=';
  const targetFeedUrl = 'https://www.edealinfo.com/rss/';
  const fullUrl = `${proxyUrl}${encodeURIComponent(targetFeedUrl)}`;

  try {
    const res = await fetch(fullUrl);
    
    if (!res.ok) {
      throw new Error(`Proxy fetch failed: ${res.status} ${res.statusText}`);
    }
    
    const xml = await res.text();
    
    // Check if the proxy returned an error page instead of XML
    if (xml.includes('<!DOCTYPE html>') || xml.includes('<html')) {
      throw new Error('Proxy returned an HTML error page. The source feed may be inaccessible.');
    }
    
    // Parse the XML feed
    const { parseString } = require('xml2js');
    const result = await new Promise((resolve, reject) => {
      parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    // Check if the expected RSS structure exists
    if (!result || !result.rss || !result.rss.channel || !result.rss.channel.item) {
      console.warn('RSS structure is not as expected. Feed may be from a different source.');
      return [];
    }

    const items = Array.isArray(result.rss.channel.item)
      ? result.rss.channel.item
      : [result.rss.channel.item];

    const parsedFeed = items.map((item) => {
      // Extract price from description using a simple regex
      const priceMatch = item.description?.match(/\$(\d+\.\d{2})/);
      const price = priceMatch ? priceMatch[0] : 'Price not available';

      // Extract image URL from description
      const imageMatch = item.description?.match(/<img[^>]+src="([^">]+)"/);
      const imageUrl = imageMatch ? imageMatch[1] : null;

      return {
        title: item.title || 'No title',
        link: item.link || '#',
        price: price,
        imageUrl: imageUrl,
        description: item.description ? item.description.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : 'No description',
      };
    });

    return parsedFeed;
  } catch (error) {
    console.error('Error fetching deals:', error.message);
    // Return an empty array for deals on error to prevent frontend crash
    return [];
  }
}

// The main page component
export default function Home() {
  // Use state to manage deals and search term
  const [deals, setDeals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch deals on component mount
  useEffect(() => {
    getDeals().then(fetchedDeals => {
      setDeals(fetchedDeals);
    });
  }, []);

  const filteredDeals = deals.filter(deal =>
    deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      <Head>
        <title>eSchoolDeals</title>
        <meta name="description" content="Find the best deals for school and home" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <nav style={{ backgroundColor: 'white', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', padding: '1rem 0' }}>
        <div style={{ maxWidth: '7xl', margin: '0 auto', padding: '0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>eSchoolDeals</h1>
          <div>
            <input
              type="text"
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', outline: 'none' }}
            />
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '7xl', margin: '1.5rem auto', padding: '0 1rem' }}>
        {filteredDeals.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredDeals.map((deal, index) => (
              <div key={index} style={{ backgroundColor: 'white', borderRadius: '0.5rem', overflow:*

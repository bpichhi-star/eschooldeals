// app/page.jsx
'use client'; // This is a Client Component because it uses useState

import { useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import styles from '../styles/Home.module.css';

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
  useState(() => {
    getDeals().then(fetchedDeals => {
      setDeals(fetchedDeals);
    });
  }, []);

  const filteredDeals = deals.filter(deal =>
    deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <Head>
        <title>eSchoolDeals</title>
        <meta name="description" content="Find the best deals for school and home" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <h1 className={styles.logo}>eSchoolDeals</h1>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        {filteredDeals.length > 0 ? (
          <div className={styles.grid}>
            {filteredDeals.map((deal, index) => (
              <div key={index} className={styles.card}>
                {deal.imageUrl ? (
                  <Image
                    src={deal.imageUrl}
                    alt={deal.title}
                    width={200}
                    height={200}
                    className={styles.dealImage}
                    onError={(e) => {
                      e.target.src = '/images/placeholder.png';
                    }}
                  />
                ) : (
                  <div className={styles.imagePlaceholder}>No Image</div>
                )}
                <h2>{deal.title}</h2>
                <p className={styles.price}>{deal.price}</p>
                <p>{deal.description}</p>
                <a href={deal.link} target="_blank" rel="noopener noreferrer" className={styles.dealLink}>
                  View Deal
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.noDeals}>
            <p>No deals available at the moment.</p>
            <p>Please check back later!</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={styles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
    </div>
  );
}

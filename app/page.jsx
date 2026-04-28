// app/page.jsx
'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';

async function getDeals() {
  const proxyUrl = 'https://rss-proxy.letscorp.net/?target=';
  const targetFeedUrl = 'https://www.edealinfo.com/rss/';
  const fullUrl = `${proxyUrl}${encodeURIComponent(targetFeedUrl)}`;

  try {
    const res = await fetch(fullUrl);
    
    if (!res.ok) {
      throw new Error(`Proxy fetch failed: ${res.status} ${res.statusText}`);
    }
    
    const xml = await res.text();
    
    if (xml.includes('<!DOCTYPE html>') || xml.includes('<html')) {
      throw new Error('Proxy returned an HTML error page. The source feed may be inaccessible.');
    }
    
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

    if (!result || !result.rss || !result.rss.channel || !result.rss.channel.item) {
      console.warn('RSS structure is not as expected. Feed may be from a different source.');
      return [];
    }

    const items = Array.isArray(result.rss.channel.item)
      ? result.rss.channel.item
      : [result.rss.channel.item];

    const parsedFeed = items.map((item) => {
      const priceMatch = item.description?.match(/\$(\d+\.\d{2})/);
      const price = priceMatch ? priceMatch[0] : 'Price not available';

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
    return [];
  }
}

export default function Home() {
  const [deals, setDeals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      <main style={{ maxWidth: '1200px', margin: '1.5rem auto', padding: '0 1rem' }}>
        {filteredDeals.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredDeals.map((deal, index) => (
              <div key={index} style={{ backgroundColor: 'white', borderRadius: '0.5rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {deal.imageUrl ? (
                  <Image
                    src={deal.imageUrl}
                    alt={deal.title}
                    width={300}
                    height={200}
                    style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzM.orgLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlNWU1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTZweCIgZmlsbD0iIzljOWM5YyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '200px', backgroundColor: '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9c9c9c' }}>
                    No Image
                  </div>
                )}
                <div style={{ padding: '1rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>{deal.title}</h2>
                  <p style={{ color: '#1f2937', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.5rem' }}>{deal.price}</p>
                  <p style={{ color: '#4b5563', fontSize: '0.875rem', marginBottom: '1rem' }}>{deal.description}</p>
                  <a
                    href={deal.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-block', backgroundColor: '#2563eb', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', textDecoration: 'none' }}
                  >
                    View Deal
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>No deals available at the moment.</p>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Please check back later!</p>
          </div>
        )}
      </main>

      <footer style={{ backgroundColor: 'white', borderTop: '1px solid #e5e5e5', padding: '2rem 0', marginTop: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem', textAlign: 'center' }}>
          <a
            href="https://vercel.com?utm_source极速赛车开奖结果记录|极速赛车开奖官网直播create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Powered by{' '}
            <span style={{ marginLeft: '0.5rem' }}>
              <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}

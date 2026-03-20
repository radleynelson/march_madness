/**
 * Vercel serverless function: GET /api/kalshi/*
 * Proxies requests to Kalshi API to avoid CORS issues.
 */

import { request as httpsRequest } from 'https';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  const path = req.url.replace(/^\/api\/kalshi/, '') || '/trade-api/v2/markets';

  return new Promise((resolve) => {
    const proxyReq = httpsRequest({
      hostname: 'api.elections.kalshi.com',
      path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', (c) => chunks.push(c));
      proxyRes.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=15');
        res.status(proxyRes.statusCode || 200).send(body);
        resolve();
      });
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: err.message });
      resolve();
    });

    proxyReq.end();
  });
}

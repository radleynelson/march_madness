/**
 * Vercel serverless function: GET /api/kalshi/*
 * Proxies requests to Kalshi API to avoid CORS issues.
 */

import { request as httpsRequest } from 'https';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'KALSHI-ACCESS-KEY, KALSHI-ACCESS-SIGNATURE, KALSHI-ACCESS-TIMESTAMP');
    return res.status(204).end();
  }

  const path = req.url.replace(/^\/api\/kalshi/, '') || '/trade-api/v2/markets';

  // Forward Kalshi auth headers if present
  const headers = { 'Accept': 'application/json' };
  const kalshiKey = req.headers['kalshi-access-key'];
  const kalshiSig = req.headers['kalshi-access-signature'];
  const kalshiTs = req.headers['kalshi-access-timestamp'];
  if (kalshiKey && kalshiSig && kalshiTs) {
    headers['KALSHI-ACCESS-KEY'] = kalshiKey;
    headers['KALSHI-ACCESS-SIGNATURE'] = kalshiSig;
    headers['KALSHI-ACCESS-TIMESTAMP'] = kalshiTs;
  }

  return new Promise((resolve) => {
    const proxyReq = httpsRequest({
      hostname: 'api.elections.kalshi.com',
      path,
      method: 'GET',
      headers,
    }, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', (c) => chunks.push(c));
      proxyRes.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        const isAuthed = !!kalshiKey;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', isAuthed ? 'no-store' : 'public, max-age=15');
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

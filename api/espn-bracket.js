/**
 * Vercel serverless function: GET /api/espn-bracket/*
 * Proxies requests to ESPN Gambit API to avoid CORS issues.
 */

import { request as httpsRequest } from 'https';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  const path = req.url.replace(/^\/api\/espn-bracket/, '/apis/v1/challenges/277') || '/apis/v1/challenges/277';

  return new Promise((resolve) => {
    const proxyReq = httpsRequest({
      hostname: 'gambit-api.fantasy.espn.com',
      path,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', (c) => chunks.push(c));
      proxyRes.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=30');
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

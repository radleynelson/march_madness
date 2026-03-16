/**
 * Vercel serverless function: GET /api/torvik
 * Proxies requests to barttorvik.com to avoid CORS issues.
 */

import { request as httpsRequest } from 'https';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  const path = req.url.replace(/^\/api\/torvik/, '') || '/2026_team_results.json';

  return new Promise((resolve) => {
    const proxyReq = httpsRequest({
      hostname: 'barttorvik.com',
      path,
      method: 'GET',
    }, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', (c) => chunks.push(c));
      proxyRes.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=3600');
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

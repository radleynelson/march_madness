/**
 * Vercel serverless function: POST /api/ai/chat
 *
 * Calls the Anthropic Messages API (same logic as the "api" provider path
 * in server.mjs). Uses Node.js built-in https module — no npm deps.
 */

import { request as httpsRequest } from 'https';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callAnthropicApi(messages, systemPrompt, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      system: systemPrompt || undefined,
      messages,
      tools: [{ type: 'web_search_20250305' }],
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    };

    const req = httpsRequest(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          const data = JSON.parse(raw);
          if (data.error) {
            return reject({
              status: res.statusCode || 500,
              message: data.error.message || JSON.stringify(data.error),
            });
          }
          resolve(data);
        } catch {
          reject({
            status: 500,
            message: `Failed to parse API response: ${raw.slice(0, 500)}`,
          });
        }
      });
    });

    req.on('error', (err) =>
      reject({ status: 502, message: `API request failed: ${err.message}` }),
    );
    req.write(payload);
    req.end();
  });
}

function extractTextFromApiResponse(apiResponse) {
  if (!apiResponse || !apiResponse.content) return '';
  return apiResponse.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;

  if (!body) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { messages, context, apiKey } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey is required' });
  }

  try {
    const systemPrompt = context
      ? `You are an expert NCAA March Madness analyst. Use the following context about the matchup/bracket when answering:\n\n${context}`
      : 'You are an expert NCAA March Madness analyst.';

    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const apiResponse = await callAnthropicApi(apiMessages, systemPrompt, apiKey);
    const content = extractTextFromApiResponse(apiResponse);

    return res.status(200).json({ content });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Unknown error';
    return res.status(status).json({ error: message });
  }
}

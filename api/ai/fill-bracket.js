/**
 * Vercel serverless function: POST /api/ai/fill-bracket
 *
 * Calls the Anthropic Messages API to fill in bracket picks (same logic as
 * the "api" provider path in server.mjs). Uses Node.js built-in https
 * module — no npm deps.
 */

import { request as httpsRequest } from 'https';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILL_BRACKET_SYSTEM = `You are an expert NCAA March Madness bracket analyst. You will be given the current state of a bracket and must return picks for every remaining matchup.

IMPORTANT: Respond ONLY with a JSON object in this exact format — no markdown fences, no extra commentary outside the JSON:

{
  "picks": {
    "E-R64-0": "top",
    "E-R64-1": "bottom",
    ...
  },
  "reasoning": "A brief explanation of your strategy and key picks."
}

Rules:
- Each key in "picks" is a matchup ID.
- Each value is either "top" (the higher-seeded / first-listed team wins) or "bottom" (the lower-seeded / second-listed team wins).
- Fill in ALL matchups that have not yet been decided.
- Base your picks on team strength, historical performance, matchup dynamics, and any relevant data from the current season.
- IMPORTANT: If the user provides additional instructions, you MUST follow them. They take priority over default analysis. For example, if the user says "favor upsets" or "pick based on NIL budget", adjust your picks accordingly and explain how you incorporated their instructions in your reasoning.`;

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

/**
 * Try to extract a JSON object from a string that may contain markdown
 * fences or surrounding text.
 */
function extractJson(text) {
  if (!text) return null;

  // 1. Try direct parse
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // 2. Try to find a JSON block inside markdown fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch { /* continue */ }
  }

  // 3. Try to find the first { ... } block
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1));
    } catch { /* continue */ }
  }

  return null;
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

  const { bracketContext, apiKey, userPrompt: customPrompt } = body;

  if (!bracketContext) {
    return res.status(400).json({ error: 'bracketContext is required' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey is required' });
  }

  let userPrompt = '';
  if (customPrompt) {
    userPrompt += `USER'S INSTRUCTIONS (YOU MUST FOLLOW THESE — THEY OVERRIDE EVERYTHING ELSE):\n${customPrompt}\n\nYou MUST use web search to research what the user is asking about before making picks. Do NOT just rely on the bracket data below. Actually search the web, find the relevant information, and make your picks based on what the user asked for. The bracket data below is only for knowing which teams are playing and the matchup IDs.\n\n---\n\n`;
  }
  userPrompt += `Here is the current bracket state:\n\n${bracketContext}\n\nPlease fill in all remaining matchups${customPrompt ? ' based on the user\'s instructions above (use web search!)' : ''}. Return ONLY the JSON object with picks and reasoning.${customPrompt ? ' In your reasoning, explain what you found from web search and how you applied the user\'s criteria.' : ''}`;

  try {
    const apiMessages = [{ role: 'user', content: userPrompt }];
    const apiSystemPrompt = FILL_BRACKET_SYSTEM + (customPrompt ? `

ADDITIONAL PRIORITY INSTRUCTIONS:
The user has provided specific criteria for making picks. Their criteria is the PRIMARY factor — use web search if needed to research it. However, you still have all the bracket data, team ratings, and model probabilities as context. When the user's criteria doesn't give a clear answer for a matchup (e.g., no data available for both teams), fall back on the team ratings and model probabilities provided in the bracket data.

In your reasoning, always reference actual team names (never say "top team" or "bottom team"). Explain how you applied the user's criteria AND note where you fell back on model analysis.` : '');
    const apiResponse = await callAnthropicApi(apiMessages, apiSystemPrompt, apiKey);
    const rawContent = extractTextFromApiResponse(apiResponse);

    // Attempt to parse the JSON from Claude's response
    const parsed = extractJson(rawContent);
    if (parsed && parsed.picks) {
      return res.status(200).json({
        picks: parsed.picks,
        reasoning: parsed.reasoning || '',
      });
    }

    // If we couldn't parse it, return the raw content so the client can try
    return res.status(200).json({
      raw: rawContent,
      picks: null,
      reasoning: 'Failed to parse structured picks from AI response.',
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Unknown error';
    return res.status(status).json({ error: message });
  }
}

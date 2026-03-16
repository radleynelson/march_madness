import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execFile, exec, spawn } from 'child_process';
import { request as httpsRequest } from 'https';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '5198');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = ['http://localhost:5200', 'http://localhost:5199'];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// CLI provider – call the local `claude` binary
// ---------------------------------------------------------------------------
function callCli(prompt) {
  return new Promise((resolve, reject) => {
    // Write prompt to a temp file to avoid stdin buffering issues with long prompts
    const tmpDir = mkdtempSync(join(tmpdir(), 'mm-ai-'));
    const tmpFile = join(tmpDir, 'prompt.txt');
    writeFileSync(tmpFile, prompt, 'utf-8');

    const child = spawn('claude', ['--print', '--output-format', 'json', '--allowedTools', 'WebSearch,WebFetch'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600_000, // 10 minutes — web search for 68 teams can be slow
      env: { ...process.env },
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      try { unlinkSync(tmpFile); } catch {}
      if (err.code === 'ENOENT') {
        reject({ status: 503, message: 'Claude CLI is not installed or not in PATH' });
      } else {
        reject({ status: 500, message: `CLI error: ${err.message}` });
      }
    });

    child.on('close', (code) => {
      try { unlinkSync(tmpFile); } catch {}
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();

      if (code !== 0 && !stdout) {
        reject({ status: 500, message: `CLI exited with code ${code}: ${stderr || 'Unknown error'}` });
      } else {
        resolve(stdout);
      }
    });

    // Pipe the prompt via stdin
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// API provider – call the Anthropic Messages API directly
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
            return reject({ status: res.statusCode || 500, message: data.error.message || JSON.stringify(data.error) });
          }
          resolve(data);
        } catch {
          reject({ status: 500, message: `Failed to parse API response: ${raw.slice(0, 500)}` });
        }
      });
    });

    req.on('error', (err) => reject({ status: 502, message: `API request failed: ${err.message}` }));
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Extract text content from an Anthropic API response
// ---------------------------------------------------------------------------
function extractTextFromApiResponse(apiResponse) {
  if (!apiResponse || !apiResponse.content) return '';
  return apiResponse.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Route: POST /api/ai/chat
// ---------------------------------------------------------------------------
async function handleChat(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { messages, context, provider, apiKey } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return sendJson(res, 400, { error: 'messages array is required' });
  }
  if (!provider || !['cli', 'api'].includes(provider)) {
    return sendJson(res, 400, { error: "provider must be 'cli' or 'api'" });
  }

  try {
    if (provider === 'cli') {
      // Build a single prompt string from the messages + context
      let prompt = '';
      if (context) {
        prompt += `Context:\n${context}\n\n`;
      }
      for (const msg of messages) {
        prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      }
      prompt += 'Assistant:';

      const raw = await callCli(prompt);

      // The CLI with --output-format json returns a JSON blob; try to parse it
      let content;
      try {
        const parsed = JSON.parse(raw);
        // The CLI JSON output has a "result" field with the text
        content = parsed.result || parsed.text || parsed.content || raw;
      } catch {
        // If it isn't valid JSON, use the raw output as-is
        content = raw.trim();
      }

      return sendJson(res, 200, { content });

    } else {
      // API provider
      if (!apiKey) {
        return sendJson(res, 400, { error: 'apiKey is required for the api provider' });
      }

      const systemPrompt = context
        ? `You are an expert NCAA March Madness analyst. Use the following context about the matchup/bracket when answering:\n\n${context}`
        : 'You are an expert NCAA March Madness analyst.';

      const apiMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const apiResponse = await callAnthropicApi(apiMessages, systemPrompt, apiKey);
      const content = extractTextFromApiResponse(apiResponse);
      return sendJson(res, 200, { content });
    }
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Unknown error';
    return sendJson(res, status, { error: message });
  }
}

// ---------------------------------------------------------------------------
// Route: POST /api/ai/fill-bracket
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

async function handleFillBracket(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { bracketContext, provider, apiKey, userPrompt: customPrompt } = body;

  if (!bracketContext) {
    return sendJson(res, 400, { error: 'bracketContext is required' });
  }
  if (!provider || !['cli', 'api'].includes(provider)) {
    return sendJson(res, 400, { error: "provider must be 'cli' or 'api'" });
  }

  let userPrompt = '';
  if (customPrompt) {
    userPrompt += `USER'S INSTRUCTIONS (YOU MUST FOLLOW THESE — THEY OVERRIDE EVERYTHING ELSE):\n${customPrompt}\n\nYou MUST use web search to research what the user is asking about before making picks. Do NOT just rely on the bracket data below. Actually search the web, find the relevant information, and make your picks based on what the user asked for. The bracket data below is only for knowing which teams are playing and the matchup IDs.\n\n---\n\n`;
  }
  userPrompt += `Here is the current bracket state:\n\n${bracketContext}\n\nPlease fill in all remaining matchups${customPrompt ? ' based on the user\'s instructions above (use web search!)' : ''}. Return ONLY the JSON object with picks and reasoning.${customPrompt ? ' In your reasoning, explain what you found from web search and how you applied the user\'s criteria.' : ''}`;

  try {
    let rawContent;

    console.log(`[fill-bracket] provider=${provider}, customPrompt=${customPrompt ? `"${customPrompt.slice(0, 80)}..."` : 'none'}`);
    console.log(`[fill-bracket] userPrompt length: ${userPrompt.length} chars`);

    if (provider === 'cli') {
      const systemPrompt = FILL_BRACKET_SYSTEM + (customPrompt ? `

ADDITIONAL PRIORITY INSTRUCTIONS:
The user has provided specific criteria for making picks. Their criteria is the PRIMARY factor — use web search if needed to research it. However, you still have all the bracket data, team ratings, and model probabilities as context. When the user's criteria doesn't give a clear answer for a matchup (e.g., no data available for both teams), fall back on the team ratings and model probabilities provided in the bracket data.

In your reasoning, always reference actual team names (never say "top team" or "bottom team"). Explain how you applied the user's criteria AND note where you fell back on model analysis.` : '');

      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      console.log(`[fill-bracket] CLI prompt first 500 chars:\n${fullPrompt.slice(0, 500)}`);
      const raw = await callCli(fullPrompt);

      // Try to parse CLI JSON wrapper
      try {
        const parsed = JSON.parse(raw);
        rawContent = parsed.result || parsed.text || parsed.content || raw;
      } catch {
        rawContent = raw.trim();
      }

    } else {
      if (!apiKey) {
        return sendJson(res, 400, { error: 'apiKey is required for the api provider' });
      }

      const apiMessages = [{ role: 'user', content: userPrompt }];
      const apiSystemPrompt = FILL_BRACKET_SYSTEM + (customPrompt ? `

ADDITIONAL PRIORITY INSTRUCTIONS:
The user has provided specific criteria for making picks. Their criteria is the PRIMARY factor — use web search if needed to research it. However, you still have all the bracket data, team ratings, and model probabilities as context. When the user's criteria doesn't give a clear answer for a matchup (e.g., no data available for both teams), fall back on the team ratings and model probabilities provided in the bracket data.

In your reasoning, always reference actual team names (never say "top team" or "bottom team"). Explain how you applied the user's criteria AND note where you fell back on model analysis.` : '');
      const apiResponse = await callAnthropicApi(apiMessages, apiSystemPrompt, apiKey);
      rawContent = extractTextFromApiResponse(apiResponse);
    }

    // Attempt to parse the JSON from Claude's response
    const parsed = extractJson(rawContent);
    if (parsed && parsed.picks) {
      return sendJson(res, 200, { picks: parsed.picks, reasoning: parsed.reasoning || '' });
    }

    // If we couldn't parse it, return the raw content so the client can try
    return sendJson(res, 200, { raw: rawContent, picks: null, reasoning: 'Failed to parse structured picks from AI response.' });

  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Unknown error';
    return sendJson(res, status, { error: message });
  }
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
// Route: GET /api/ai/status
// ---------------------------------------------------------------------------
function handleStatus(_req, res) {
  exec('which claude', { timeout: 5000 }, (err, stdout) => {
    if (err || !stdout.trim()) {
      return sendJson(res, 200, { cliAvailable: false });
    }
    // Double-check by trying --version
    exec('claude --version', { timeout: 5000 }, (err2, stdout2) => {
      if (err2) {
        return sendJson(res, 200, { cliAvailable: false });
      }
      return sendJson(res, 200, { cliAvailable: true, version: stdout2.trim(), path: stdout.trim() });
    });
  });
}

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  // CORS: set headers for all responses
  setCorsHeaders(req, res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Parse the URL (strip query string)
  const url = req.url.split('?')[0];

  // ---- API routes ----
  try {
    if (url === '/api/ai/chat' && req.method === 'POST') {
      return await handleChat(req, res);
    }

    if (url === '/api/ai/fill-bracket' && req.method === 'POST') {
      return await handleFillBracket(req, res);
    }

    if (url === '/api/ai/status' && req.method === 'GET') {
      return handleStatus(req, res);
    }
  } catch (err) {
    console.error('Unhandled API error:', err);
    if (!res.headersSent) {
      return sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  // ---- Static file serving (existing behaviour) ----
  let filePath = join(DIST, url === '/' ? 'index.html' : url);
  if (!existsSync(filePath)) filePath = join(DIST, 'index.html');
  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const data = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Serving on http://localhost:${PORT}`);
  console.log('AI endpoints available:');
  console.log('  POST /api/ai/chat');
  console.log('  POST /api/ai/fill-bracket');
  console.log('  GET  /api/ai/status');
});

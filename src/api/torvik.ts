import type { TorvikRatingsMap } from '../types/torvik';
import { parseTorvikData } from '../model/ratings';
import { cache } from './cache';

const TORVIK_URL = '/api/torvik/2026_team_results.json';
const TORVIK_DIRECT_URL = 'https://barttorvik.com/2026_team_results.json';
const CACHE_KEY = 'torvik-ratings';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Bart Torvik team ratings.
 * Tries the Vite proxy first (for dev), then direct URL (for production).
 */
export async function fetchTorvikRatings(): Promise<TorvikRatingsMap> {
  // Check cache first
  const cached = cache.get<TorvikRatingsMap>(CACHE_KEY);
  if (cached) return cached;

  let data: unknown[][] | null = null;

  // Try proxy first (works in dev with Vite proxy config)
  try {
    const response = await fetch(TORVIK_URL);
    if (response.ok) {
      data = await response.json();
    }
  } catch {
    // Proxy not available, try direct
  }

  // Try direct URL
  if (!data) {
    try {
      const response = await fetch(TORVIK_DIRECT_URL);
      if (response.ok) {
        data = await response.json();
      }
    } catch {
      // Direct URL also failed
    }
  }

  if (!data || !Array.isArray(data)) {
    console.warn('Could not fetch Torvik ratings, using seed-based fallback');
    return new Map();
  }

  const ratings = parseTorvikData(data);
  cache.set(CACHE_KEY, ratings, CACHE_TTL);
  return ratings;
}

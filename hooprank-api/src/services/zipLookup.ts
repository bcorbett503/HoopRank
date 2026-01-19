// src/services/zipLookup.ts
// =============================================================================
// ZIP Code to City Lookup Service
// =============================================================================
// Uses the free Zippopotam.us API to convert US zip codes to city names.
// Results are cached to reduce API calls.
// =============================================================================

import https from 'https';

// In-memory cache for zip code lookups
const zipCache: Map<string, { city: string; state: string; lat: number; lng: number; timestamp: number }> = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ZipLookupResult {
    city: string;
    state: string;
    stateAbbr: string;
    lat: number;
    lng: number;
}

/**
 * Look up city, state, and coordinates from a US zip code
 * Uses Zippopotam.us free API with caching
 */
export async function lookupZipCode(zip: string): Promise<ZipLookupResult | null> {
    if (!zip || zip.length < 5) return null;

    // Normalize to 5-digit zip
    const zipCode = zip.substring(0, 5);

    // Check cache first
    const cached = zipCache.get(zipCode);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return {
            city: cached.city,
            state: cached.state,
            stateAbbr: cached.state,
            lat: cached.lat,
            lng: cached.lng,
        };
    }

    return new Promise((resolve) => {
        const req = https.get(`https://api.zippopotam.us/us/${zipCode}`, (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }

            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const place = json.places?.[0];
                    if (place) {
                        const lat = parseFloat(place['latitude']) || 0;
                        const lng = parseFloat(place['longitude']) || 0;

                        const result = {
                            city: place['place name'],
                            state: place['state'],
                            stateAbbr: place['state abbreviation'],
                            lat,
                            lng,
                        };

                        // Cache the result
                        zipCache.set(zipCode, {
                            city: result.city,
                            state: result.stateAbbr,
                            lat,
                            lng,
                            timestamp: Date.now(),
                        });

                        resolve(result);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    console.error('Zip lookup parse error:', e);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Zip lookup error:', e);
            resolve(null);
        });

        // Set a timeout of 3 seconds
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(null);
        });
    });
}

/**
 * Format city and state as a display string
 */
export function formatCityState(city: string, state: string): string {
    return `${city}, ${state}`;
}


#!/usr/bin/env node
/**
 * Backfill image backing data for followed courts.
 *
 * Stores durable Google Places IDs, not expiring media URLs. The API resolves
 * those IDs through /courts/:id/image at read time.
 *
 * Usage:
 *   GOOGLE_API_KEY=... ADMIN_SECRET=... node scripts/ops/backfill_followed_court_images.js --limit 100 --confirm-billable-google-places
 *   GOOGLE_API_KEY=... ADMIN_SECRET=... node scripts/ops/backfill_followed_court_images.js --all --apply --confirm-billable-google-places
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const BASE =
  process.env.API_BASE_URL ||
  "https://heartfelt-appreciation-production-65f1.up.railway.app";
const ADMIN_USER_ID =
  process.env.HOOPRANK_ADMIN_ID || "4ODZUrySRUhFDC5wVW6dCySBprD2";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.photos",
].join(",");

function readArg(name, fallback = null) {
  const prefix = `${name}=`;
  const inline = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseIntArg(name, fallback) {
  const value = readArg(name);
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatArg(name, fallback) {
  const value = readArg(name);
  if (value === null) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tokens(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(
        (token) =>
          token.length > 2 &&
          !["the", "and", "court", "courts", "basketball"].includes(token),
      ),
  );
}

function nameSimilarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap++;
  return overlap / Math.max(left.size, right.size);
}

function normalizeCourt(raw) {
  return {
    id: cleanString(raw.id),
    name: cleanString(raw.name) || "Basketball Court",
    city: cleanString(raw.city),
    address: cleanString(raw.address),
    lat: numberValue(raw.lat ?? raw.latitude),
    lng: numberValue(raw.lng ?? raw.longitude),
    imageUrl: cleanString(raw.imageUrl ?? raw.image_url),
    imageProvider: cleanString(raw.imageProvider ?? raw.image_provider),
    imagePlaceId: cleanString(raw.imagePlaceId ?? raw.image_place_id),
  };
}

function isMissingImage(court) {
  const generatedProxy =
    court.imageUrl &&
    court.imageProvider === "google_places" &&
    court.id &&
    court.imageUrl.includes(`/courts/${court.id}/image`);
  return !court.imageUrl || generatedProxy;
}

function courtQuery(court) {
  const name = court.name.replace(/\s+Courts$/i, " basketball courts");
  if (/^basketball court$/i.test(court.name)) {
    return [court.address, court.city, "basketball court"]
      .filter(Boolean)
      .join(" ");
  }
  if (court.address) return `${name} ${court.address}`;
  return [name, court.city, "basketball"].filter(Boolean).join(" ");
}

function scorePlace(court, place, maxDistanceKm) {
  const placeLat = numberValue(place.location?.latitude);
  const placeLng = numberValue(place.location?.longitude);
  const distanceKm =
    court.lat !== null &&
    court.lng !== null &&
    placeLat !== null &&
    placeLng !== null
      ? haversineKm(court.lat, court.lng, placeLat, placeLng)
      : null;
  const similarity = nameSimilarity(court.name, place.displayName?.text || "");
  const distanceScore =
    distanceKm === null
      ? 0
      : Math.max(0, 1 - Math.min(distanceKm, maxDistanceKm) / maxDistanceKm);
  const hasPhoto = Array.isArray(place.photos) && place.photos.length > 0;
  return {
    distanceKm,
    similarity,
    hasPhoto,
    score: (hasPhoto ? 2 : 0) + distanceScore + similarity,
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(parseIntArg("--timeout-ms", 30000)),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${url} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function loadFollowedCourts(base, adminHeaders) {
  const [adminFollows, followerCounts, courts] = await Promise.all([
    fetchJson(`${base}/users/me/follows`, { headers: adminHeaders }),
    fetchJson(`${base}/courts/follower-counts`, { headers: adminHeaders }),
    fetchJson(`${base}/courts`),
  ]);

  const adminIds = new Set(
    (adminFollows.courts || [])
      .map((row) => cleanString(row.courtId))
      .filter(Boolean),
  );
  const followedIds = new Set(
    (Array.isArray(followerCounts) ? followerCounts : [])
      .map((row) => cleanString(row.courtId))
      .filter(Boolean),
  );
  for (const id of adminIds) followedIds.add(id);

  const courtById = new Map(
    (Array.isArray(courts) ? courts : []).map((court) => [
      court.id,
      normalizeCourt(court),
    ]),
  );

  return [...followedIds]
    .map((id) => courtById.get(id))
    .filter(Boolean)
    .filter(isMissingImage)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function searchPlaces(court, apiKey, options) {
  const body = {
    textQuery: courtQuery(court),
    maxResultCount: options.maxResults,
    languageCode: "en",
  };

  if (court.lat !== null && court.lng !== null) {
    body.locationBias = {
      circle: {
        center: { latitude: court.lat, longitude: court.lng },
        radius: Math.max(200, Math.round(options.maxDistanceKm * 1000)),
      },
    };
  }

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(parseIntArg("--timeout-ms", 30000)),
    },
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Places Text Search failed: ${res.status} ${errorText.slice(0, 200)}`,
    );
  }

  const parsed = await res.json();
  return parsed.places || [];
}

async function resolvePlacePhotoUri(photoName, apiKey) {
  const cleaned = cleanString(photoName);
  if (!cleaned) return null;
  const res = await fetch(
    `https://places.googleapis.com/v1/${cleaned}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${encodeURIComponent(
      apiKey,
    )}`,
    { signal: AbortSignal.timeout(parseIntArg("--timeout-ms", 30000)) },
  );
  if (!res.ok) return null;
  const parsed = await res.json();
  return cleanString(parsed.photoUri);
}

async function findCandidate(court, apiKey, options) {
  if (!court.id)
    return { status: "skipped", reason: "missing_court_id", court };
  if (court.lat === null || court.lng === null) {
    return { status: "skipped", reason: "missing_coordinates", court };
  }

  const places = await searchPlaces(court, apiKey, options);
  const ranked = places
    .map((place) => ({
      place,
      ranking: scorePlace(court, place, options.maxDistanceKm),
    }))
    .filter(
      ({ ranking }) =>
        ranking.distanceKm === null ||
        ranking.distanceKm <= options.maxDistanceKm,
    )
    .sort((a, b) => b.ranking.score - a.ranking.score);

  const bestWithPhoto = ranked.find(({ ranking }) => ranking.hasPhoto);
  const best = bestWithPhoto || ranked[0];
  if (!best) return { status: "no_match", court, query: courtQuery(court) };

  const photoCount = Array.isArray(best.place.photos)
    ? best.place.photos.length
    : 0;
  const imageUrl =
    photoCount > 0
      ? await resolvePlacePhotoUri(best.place.photos?.[0]?.name, apiKey)
      : null;
  return {
    status: imageUrl ? "matched" : "no_photo",
    courtId: court.id,
    courtName: court.name,
    courtCity: court.city,
    query: courtQuery(court),
    placeId: best.place.id,
    placeName: best.place.displayName?.text || null,
    formattedAddress: best.place.formattedAddress || null,
    googleMapsUri: best.place.googleMapsUri || null,
    distanceKm:
      best.ranking.distanceKm === null
        ? null
        : Number(best.ranking.distanceKm.toFixed(3)),
    nameSimilarity: Number(best.ranking.similarity.toFixed(3)),
    photoCount,
    imageUrl,
    imageProvider: "google_places",
    imageSourceLabel: "Google Maps photo",
  };
}

async function applyBatch(base, adminHeaders, candidates) {
  if (candidates.length === 0) return { received: 0, updated: 0, skipped: 0 };
  return fetchJson(`${base}/courts/admin/images`, {
    method: "POST",
    headers: {
      ...adminHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      images: candidates.map((candidate) => ({
        courtId: candidate.courtId,
        imageProvider: "google_places",
        imagePlaceId: candidate.placeId,
        imageUrl: candidate.imageUrl,
        imageSourceUrl: candidate.googleMapsUri,
        imageSourceLabel: "Google Maps photo",
      })),
    }),
  });
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is required");
  if (!adminSecret) throw new Error("ADMIN_SECRET is required");

  const base = BASE.replace(/\/+$/, "");
  const all = hasFlag("--all");
  const apply = hasFlag("--apply");
  const limit = all ? null : parseIntArg("--limit", 100);
  const offset = parseIntArg("--offset", 0);
  const maxResults = parseIntArg("--max-results", 5);
  const maxDistanceKm = parseFloatArg("--max-distance-km", 2.0);
  const sleepMs = parseIntArg("--sleep-ms", 150);
  const batchSize = parseIntArg("--batch-size", 100);
  const output = path.resolve(
    process.cwd(),
    readArg("--output", "followed_court_image_candidates.jsonl"),
  );
  const adminHeaders = {
    "x-user-id": ADMIN_USER_ID,
    "x-admin-secret": adminSecret,
  };

  const missing = await loadFollowedCourts(base, adminHeaders);
  const selected = missing.slice(
    offset,
    limit === null ? undefined : offset + limit,
  );
  if (selected.length > 100 && !hasFlag("--confirm-billable-google-places")) {
    throw new Error(
      `Refusing to run ${selected.length} billable Places searches without --confirm-billable-google-places`,
    );
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  const stream = fs.createWriteStream(output, {
    flags: offset > 0 ? "a" : "w",
  });
  const stats = {
    followedMissingAtStart: missing.length,
    selected: selected.length,
    processed: 0,
    matched: 0,
    noPhoto: 0,
    noMatch: 0,
    skipped: 0,
    errors: 0,
    applied: 0,
  };
  let pendingApply = [];

  try {
    for (const court of selected) {
      let candidate;
      try {
        candidate = await findCandidate(court, apiKey, {
          maxResults,
          maxDistanceKm,
        });
        if (candidate.status === "matched") {
          stats.matched++;
          pendingApply.push(candidate);
        } else if (candidate.status === "no_photo") {
          stats.noPhoto++;
        } else if (candidate.status === "no_match") {
          stats.noMatch++;
        } else {
          stats.skipped++;
        }

        if (apply && pendingApply.length >= batchSize) {
          const result = await applyBatch(base, adminHeaders, pendingApply);
          stats.applied += result.updated || 0;
          pendingApply = [];
        }
      } catch (error) {
        stats.errors++;
        candidate = {
          status: "error",
          courtId: court.id,
          courtName: court.name,
          courtCity: court.city,
          error: error.message,
        };
      }

      stats.processed++;
      stream.write(`${JSON.stringify(candidate)}\n`);
      if (stats.processed % 25 === 0 || stats.processed === selected.length) {
        console.log(JSON.stringify(stats));
      }
      if (sleepMs > 0) await sleep(sleepMs);
    }

    if (apply && pendingApply.length > 0) {
      const result = await applyBatch(base, adminHeaders, pendingApply);
      stats.applied += result.updated || 0;
    }
  } finally {
    await new Promise((resolve) => stream.end(resolve));
  }

  console.log(`Wrote ${output}`);
  console.log(JSON.stringify(stats));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

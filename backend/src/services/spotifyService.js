import {
  extractSongRequest,
  formatExtractedSongQuery,
} from './songExtractionService.js';

const SPOTIFY_TOKEN_URL =
  process.env.SPOTIFY_TOKEN_URL || 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL =
  process.env.SPOTIFY_SEARCH_URL || 'https://api.spotify.com/v1/search';
const REQUEST_TIMEOUT_MS = 8_000;

let accessToken = null;
let accessTokenExpiresAt = 0;

const unavailableResult = (reason, query, candidate = null) => ({
  status: 'unavailable',
  query,
  track: null,
  reason,
  ...(candidate ? { candidate } : {}),
});

const cleanText = (value = '', maxLength = 160) =>
  String(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const safeHttpsUrl = (value = '') => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

export const normalizeSongQuery = (value = '') => {
  const query = cleanText(String(value).replace(/\[\[[^\]]+\]\]/g, ' '), 120)
    .replace(
      /^(?:(?:can|could|would) you (?:please )?play|please play|play|(?:my )?favou?rite song is|the song is|i (?:really )?(?:like|love|enjoy)(?:(?: listening| singing)(?: and (?:listening|singing))? to)?|probably)\s+/i,
      ''
    )
    .replace(/^["']|["']$/g, '')
    .replace(/[?!.]+$/, '')
    .trim();
  return query;
};

export const extractArtistOnlyRequest = (value = '') => {
  const query = normalizeSongQuery(value);
  const match = query.match(
    /^(?:i\s+(?:want|would like)(?:\s+to\s+(?:hear|listen to))?\s+)?(?:(?:(?:any|a|some|one)\s+(?:song|track))|(?:(?:any|some)\s+music)|something)\s+by\s+(.+)$/i
  );
  return match ? cleanText(match[1], 100) : '';
};

const MATCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'by',
  'or',
  'the',
]);

const toMatchTokens = (value = '') =>
  cleanText(value, 180)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[&+]/g, ' and ')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !MATCH_STOP_WORDS.has(token))
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token));

const levenshteinDistance = (left, right) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
};

const textSimilarity = (left, right) => {
  const leftTokens = toMatchTokens(left);
  const rightTokens = toMatchTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const overlap = [...leftSet].filter((token) => rightSet.has(token)).length;
  const diceScore = (2 * overlap) / (leftSet.size + rightSet.size);

  const leftPhrase = leftTokens.join('');
  const rightPhrase = rightTokens.join('');
  const editScore = 1 - (
    levenshteinDistance(leftPhrase, rightPhrase) /
    Math.max(leftPhrase.length, rightPhrase.length)
  );
  return Math.max(diceScore, editScore);
};

export const parseSongRequest = (query) => {
  const parts = query.split(/\s+by\s+/i);
  if (parts.length < 2) return { title: query, artist: '' };
  const artist = parts.pop().trim();
  return { title: parts.join(' by ').trim(), artist };
};

export const buildSpotifySearchQueries = (query = '') => {
  const { title, artist } = parseSongRequest(cleanText(query, 180));
  const searches = artist
    ? [
        `track:${title} artist:${artist}`,
        `${title} ${artist}`,
        `track:${title}`,
      ]
    : [`track:${title}`, title];

  return [...new Set(searches.map((search) => cleanText(search, 220)).filter(Boolean))];
};

const getTrackItems = (payload = {}) => {
  const legacyItems = payload.tracks?.items;
  if (Array.isArray(legacyItems)) return legacyItems;

  const currentItems = payload.items?.items;
  if (!Array.isArray(currentItems)) return [];
  return currentItems.map((entry) => entry?.item || entry).filter(Boolean);
};

export const normalizeSpotifyTrack = (track = {}) => {
  const id = cleanText(track.id, 40);
  const name = cleanText(track.name, 160);
  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist) => cleanText(artist?.name, 100)).filter(Boolean)
    : [];
  const spotifyUrl = safeHttpsUrl(track.external_urls?.spotify);
  if (!id || !name || artists.length === 0 || !spotifyUrl) return null;

  const artwork = Array.isArray(track.album?.images)
    ? track.album.images
        .map((image) => ({
          url: safeHttpsUrl(image?.url),
          width: Number(image?.width) || 0,
        }))
        .filter((image) => image.url)
        .sort((left, right) => right.width - left.width)[0]?.url || ''
    : '';

  return {
    id,
    uri: `spotify:track:${id}`,
    name,
    artists,
    artistLabel: artists.join(', '),
    album: cleanText(track.album?.name, 160),
    artwork,
    spotifyUrl,
    durationMs: Number.isFinite(track.duration_ms) ? track.duration_ms : null,
  };
};

export const scoreSpotifyTrackMatch = (track, query) => {
  const requested = parseSongRequest(query);
  const titleScore = textSimilarity(requested.title, track.name);
  const artistScore = requested.artist
    ? Math.max(...track.artists.map((artist) => textSimilarity(requested.artist, artist)))
    : null;

  if (titleScore < 0.5) return Number.NEGATIVE_INFINITY;
  if (artistScore !== null && artistScore < 0.45) return Number.NEGATIVE_INFINITY;
  return titleScore * 70 + (artistScore === null ? 0 : artistScore * 30);
};

export const selectSpotifyTrack = (payload = {}, query = '') => {
  const tracks = getTrackItems(payload);
  const candidates = tracks
    .map((rawTrack, index) => ({
      track: normalizeSpotifyTrack(rawTrack),
      explicit: rawTrack?.explicit,
      index,
    }))
    .filter((candidate) => candidate.track)
    .map((candidate) => ({
      ...candidate,
      score: query
        ? scoreSpotifyTrackMatch(candidate.track, query) - candidate.index * 0.1
        : -candidate.index * 0.1,
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => right.score - left.score);

  return candidates.find((candidate) => candidate.explicit === false)?.track || null;
};

export const inspectSpotifyTrackMatch = (payload = {}, query = '') => {
  const tracks = getTrackItems(payload);
  const candidates = tracks
    .map((rawTrack, index) => ({
      track: normalizeSpotifyTrack(rawTrack),
      explicit: rawTrack?.explicit,
      index,
    }))
    .filter((candidate) => candidate.track)
    .map((candidate) => ({
      ...candidate,
      score: query
        ? scoreSpotifyTrackMatch(candidate.track, query) - candidate.index * 0.1
        : -candidate.index * 0.1,
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => right.score - left.score);

  const cleanMatch = candidates.find((candidate) => candidate.explicit === false);
  if (cleanMatch) return { status: 'available', track: cleanMatch.track };

  const explicitMatch = candidates.find((candidate) => candidate.explicit === true);
  if (explicitMatch) {
    return {
      status: 'unavailable',
      reason: 'explicit-content',
      candidate: explicitMatch.track,
    };
  }

  return { status: 'unavailable', reason: 'no-match', candidate: null };
};

export const selectSpotifyArtistSuggestions = (payload = {}, artist = '', limit = 3) => {
  const requestedArtist = cleanText(artist, 100);
  if (!requestedArtist) return [];

  const seenTracks = new Set();
  return getTrackItems(payload)
    .map((rawTrack, index) => ({
      track: normalizeSpotifyTrack(rawTrack),
      explicit: rawTrack?.explicit,
      index,
    }))
    .filter((candidate) => candidate.track && candidate.explicit === false)
    .map((candidate) => ({
      ...candidate,
      artistScore: Math.max(
        ...candidate.track.artists.map((trackArtist) =>
          textSimilarity(requestedArtist, trackArtist)
        )
      ),
    }))
    .filter((candidate) => candidate.artistScore >= 0.7)
    .sort((left, right) =>
      (right.artistScore - right.index * 0.01) -
      (left.artistScore - left.index * 0.01)
    )
    .filter((candidate) => {
      const key = `${candidate.track.name}|${candidate.track.artistLabel}`.toLowerCase();
      if (seenTracks.has(key)) return false;
      seenTracks.add(key);
      return true;
    })
    .slice(0, Math.max(0, limit))
    .map((candidate) => candidate.track);
};

const getAccessToken = async ({ clientId, clientSecret, signal }) => {
  const now = Date.now();
  if (accessToken && accessTokenExpiresAt > now + 30_000) return accessToken;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    signal,
  });
  if (!response.ok) throw new Error(`Spotify token request failed with ${response.status}`);

  const payload = await response.json();
  if (!payload.access_token) throw new Error('Spotify token response did not include an access token');

  accessToken = payload.access_token;
  accessTokenExpiresAt = now + Math.max(Number(payload.expires_in) || 3600, 60) * 1000;
  return accessToken;
};

export const resolveSongQuery = async (
  songAnswer = '',
  { extractor = extractSongRequest } = {}
) => {
  const fallbackQuery = normalizeSongQuery(songAnswer);
  if (!fallbackQuery) return { query: '', reason: 'missing-query' };
  const deterministicArtist = extractArtistOnlyRequest(fallbackQuery);
  if (deterministicArtist) {
    return { query: '', artist: deterministicArtist, reason: 'artist-only' };
  }
  if (!process.env.OPENAI_API_KEY) return { query: fallbackQuery, reason: null };

  try {
    const extractedSong = await extractor(songAnswer);
    const query = formatExtractedSongQuery(extractedSong || {});
    if (!query && extractedSong?.artist) {
      return {
        query: '',
        artist: cleanText(extractedSong.artist, 100),
        reason: 'artist-only',
      };
    }
    return query
      ? { query, reason: null }
      : { query: '', reason: 'ambiguous-query' };
  } catch (error) {
    console.warn('[spotify] Song extraction unavailable; using the original answer:', error.message);
    return { query: fallbackQuery, reason: null };
  }
};

export const searchSpotifyTrack = async (songAnswer = '') => {
  const fallbackQuery = normalizeSongQuery(songAnswer);
  if (!fallbackQuery) return unavailableResult('missing-query', fallbackQuery);

  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return unavailableResult('not-configured', fallbackQuery);

  const { query, artist, reason } = await resolveSongQuery(songAnswer);
  if (!query && reason !== 'artist-only') {
    return unavailableResult(reason || 'missing-query', fallbackQuery);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const token = await getAccessToken({
      clientId,
      clientSecret,
      signal: controller.signal,
    });
    if (reason === 'artist-only' && artist) {
      const suggestions = [];
      const seenTrackIds = new Set();
      for (const artistSearchQuery of [`artist:${artist}`, artist]) {
        const requestUrl = new URL(SPOTIFY_SEARCH_URL);
        requestUrl.searchParams.set('q', artistSearchQuery);
        requestUrl.searchParams.set('type', 'track');
        requestUrl.searchParams.set('market', process.env.SPOTIFY_MARKET?.trim() || 'NZ');
        requestUrl.searchParams.set('limit', '10');

        const response = await fetch(requestUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Spotify search failed with ${response.status}`);

        for (const suggestion of selectSpotifyArtistSuggestions(await response.json(), artist)) {
          if (!seenTrackIds.has(suggestion.id)) {
            seenTrackIds.add(suggestion.id);
            suggestions.push(suggestion);
          }
        }
        if (suggestions.length >= 3) break;
      }

      return suggestions.length > 0
        ? {
            status: 'needs-selection',
            reason: 'artist-only',
            query: artist,
            artist,
            suggestions: suggestions.slice(0, 3),
          }
        : unavailableResult('no-match', artist);
    }

    let explicitCandidate = null;
    for (const searchQuery of buildSpotifySearchQueries(query)) {
      const requestUrl = new URL(SPOTIFY_SEARCH_URL);
      requestUrl.searchParams.set('q', searchQuery);
      requestUrl.searchParams.set('type', 'track');
      requestUrl.searchParams.set('market', process.env.SPOTIFY_MARKET?.trim() || 'NZ');
      requestUrl.searchParams.set('limit', '10');

      const response = await fetch(requestUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Spotify search failed with ${response.status}`);

      const match = inspectSpotifyTrackMatch(await response.json(), query);
      if (match.status === 'available') {
        return {
          status: 'available',
          query,
          track: match.track,
          matchedAt: new Date().toISOString(),
        };
      }
      if (!explicitCandidate && match.reason === 'explicit-content') {
        explicitCandidate = match.candidate;
      }
    }

    return explicitCandidate
      ? unavailableResult('explicit-content', query, explicitCandidate)
      : unavailableResult('no-match', query);
  } catch (error) {
    console.warn('[spotify] Theme song unavailable:', error.message);
    return unavailableResult('request-failed', query);
  } finally {
    clearTimeout(timeout);
  }
};

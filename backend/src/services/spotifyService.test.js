import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSongQuery,
  normalizeSpotifyTrack,
  selectSpotifyTrack,
} from './spotifyService.js';

const track = (overrides = {}) => ({
  id: 'track-123',
  name: 'Here Comes the Sun',
  artists: [{ name: 'The Beatles' }],
  album: {
    name: 'Abbey Road',
    images: [
      { url: 'https://i.scdn.co/image/small', width: 64 },
      { url: 'https://i.scdn.co/image/large', width: 640 },
    ],
  },
  external_urls: { spotify: 'https://open.spotify.com/track/track-123' },
  duration_ms: 185000,
  explicit: false,
  ...overrides,
});

test('normalizes a conversational favourite-song answer', () => {
  assert.equal(
    normalizeSongQuery('My favourite song is Here Comes the Sun by The Beatles'),
    'Here Comes the Sun by The Beatles'
  );
  assert.equal(
    normalizeSongQuery('Can you play Black and White by Michael Jackson?'),
    'Black and White by Michael Jackson'
  );
});

test('normalizes safe Spotify track display fields', () => {
  const selected = normalizeSpotifyTrack(track());

  assert.equal(selected.name, 'Here Comes the Sun');
  assert.equal(selected.artistLabel, 'The Beatles');
  assert.equal(selected.artwork, 'https://i.scdn.co/image/large');
  assert.equal(selected.uri, 'spotify:track:track-123');
});

test('selects the first non-explicit result', () => {
  const selected = selectSpotifyTrack({
    tracks: {
      items: [
        track({ id: 'explicit-track', explicit: true }),
        track({ id: 'clean-track' }),
      ],
    },
  });

  assert.equal(selected.id, 'clean-track');
});

test('supports the current wrapped search-result shape', () => {
  const selected = selectSpotifyTrack({
    items: {
      items: [{ item: track({ id: 'wrapped-track' }) }],
    },
  });

  assert.equal(selected.id, 'wrapped-track');
});

test('prefers the requested title and artist over an unrelated first result', () => {
  const selected = selectSpotifyTrack({
    tracks: {
      items: [
        track({
          id: 'wrong-track',
          name: 'Pink + White',
          artists: [{ name: 'Frank Ocean' }],
        }),
        track({
          id: 'correct-track',
          name: 'Black or White',
          artists: [{ name: 'Michael Jackson' }],
        }),
      ],
    },
  }, 'Black and White by Michael Jackson');

  assert.equal(selected.id, 'correct-track');
});

test('rejects candidates by a different artist when an artist was requested', () => {
  const selected = selectSpotifyTrack({
    tracks: {
      items: [
        track({
          name: 'Pink + White',
          artists: [{ name: 'Frank Ocean' }],
        }),
      ],
    },
  }, 'Black and White by Michael Jackson');

  assert.equal(selected, null);
});

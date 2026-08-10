import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import {
  buildSavedThemeSong,
  getThemeSongForSession,
} from './sessionOrchestratorService.js';

const availableSong = {
  status: 'available',
  query: 'Clementine by grentperez',
  matchedAt: '2026-08-11T01:00:00.000Z',
  track: {
    id: 'spotify-track-id',
    uri: 'spotify:track:spotify-track-id',
    name: 'Clementine',
    artists: ['grentperez'],
    artistLabel: 'grentperez',
    album: 'Clementine',
    artwork: 'https://i.scdn.co/image/example',
    spotifyUrl: 'https://open.spotify.com/track/spotify-track-id',
    durationMs: 234000,
  },
};

test('builds a durable user theme-song record from a resolved Spotify track', () => {
  const savedAt = new Date('2026-08-11T02:00:00.000Z');
  const sourceSessionId = '507f1f77bcf86cd799439011';
  const savedThemeSong = buildSavedThemeSong(availableSong, {
    sourceSessionId,
    savedAt,
  });
  const user = new User({ name: 'Ryan', savedThemeSong });

  assert.equal(user.validateSync(), undefined);
  assert.equal(savedThemeSong.track.uri, 'spotify:track:spotify-track-id');
  assert.equal(savedThemeSong.sourceSessionId, sourceSessionId);
  assert.equal(savedThemeSong.savedAt, savedAt);
});

test('future sessions use the saved user song unless the session has its own selection', () => {
  const savedThemeSong = buildSavedThemeSong(availableSong, {
    sourceSessionId: '507f1f77bcf86cd799439011',
  });
  const currentSelection = {
    ...availableSong,
    query: 'Here Comes the Sun by The Beatles',
    track: {
      ...availableSong.track,
      id: 'new-track-id',
      uri: 'spotify:track:new-track-id',
      name: 'Here Comes the Sun',
      artists: ['The Beatles'],
      artistLabel: 'The Beatles',
    },
  };

  assert.equal(
    getThemeSongForSession({ interactionState: {} }, { savedThemeSong }),
    savedThemeSong
  );
  assert.equal(
    getThemeSongForSession(
      { interactionState: { themeSong: currentSelection } },
      { savedThemeSong }
    ),
    currentSelection
  );
});

test('does not overwrite a saved song with an unavailable search result', () => {
  assert.equal(buildSavedThemeSong({ status: 'unavailable' }, {
    sourceSessionId: '507f1f77bcf86cd799439011',
  }), null);
});

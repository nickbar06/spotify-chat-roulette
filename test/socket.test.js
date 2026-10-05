const CircularBuffer = require('../CircularBuffer');
const { normalizePlayback, normalizeTrack } = require('../lib/spotify');
const { LOBBY } = require('../lib/socket');
const {
  DEMO_ROOMS,
  createDemoMessage,
  roomSummary,
  seedDemoHistory,
} = require('../lib/demoChats');

describe('chat and playback primitives', () => {
  test('keeps only the newest 100 room messages', () => {
    const buffer = new CircularBuffer(100);
    for (let index = 0; index < 105; index += 1) buffer.add({ index });

    const messages = buffer.getAll();
    expect(messages).toHaveLength(100);
    expect(messages[0]).toEqual({ index: 5 });
    expect(messages[99]).toEqual({ index: 104 });
  });

  test('normalizes a Spotify playback response for the client', () => {
    const playback = normalizePlayback({
      is_playing: true,
      progress_ms: 42_000,
      timestamp: 100,
      item: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'A Song',
        type: 'track',
        duration_ms: 180_000,
        artists: [{ id: 'artist-1', name: 'An Artist' }],
        album: { id: 'album-1', name: 'An Album', images: [{ url: 'cover.jpg' }] },
      },
    });

    expect(playback).toEqual(
      expect.objectContaining({
        available: true,
        isPlaying: true,
        progressMs: 42_000,
      }),
    );
    expect(playback.track.artists[0]).toEqual(
      expect.objectContaining({ id: 'artist-1', name: 'An Artist' }),
    );
  });

  test('handles an idle Spotify session', () => {
    expect(normalizePlayback({})).toEqual(
      expect.objectContaining({
        available: false,
        isPlaying: false,
        track: null,
      }),
    );
    expect(normalizeTrack(null)).toBeNull();
    expect(LOBBY).toEqual({ id: 'lobby', name: 'The Lobby' });
  });

  test('provides labeled demo listeners and active-room counts', () => {
    const room = DEMO_ROOMS[0];
    const summary = roomSummary(room, 2);
    const message = createDemoMessage(room, 0);

    expect(summary.listenerCount).toBe(room.bots.length + 2);
    expect(summary.participants.every((participant) => participant.isBot)).toBe(true);
    expect(message.demo).toBe(true);
    expect(message.user.currentArtist).toBe(room.name);
  });

  test('seeds chat history in every demo room', () => {
    const seeded = [];
    seedDemoHistory((roomId, message) => seeded.push({ roomId, message }));

    expect(seeded).toHaveLength(DEMO_ROOMS.length * 3);
    DEMO_ROOMS.forEach((room) => {
      expect(seeded.filter((entry) => entry.roomId === room.id)).toHaveLength(3);
    });
  });
});

const crypto = require('crypto');

const DEMO_ROOMS = [
  {
    id: 'artist:4q3ewBCX7sLwd24euuV69X',
    artistId: '4q3ewBCX7sLwd24euuV69X',
    name: 'Bad Bunny',
    track: 'NUEVAYoL',
    bots: [
      { id: 'bot-luna', name: 'Luna', image: null, isBot: true, tagline: 'Reggaeton on repeat', topArtists: ['Bad Bunny', 'Rauw Alejandro', 'Feid'] },
      { id: 'bot-mateo', name: 'Mateo', image: null, isBot: true, tagline: 'Always building a summer playlist', topArtists: ['Bad Bunny', 'Mora', 'J Balvin'] },
      { id: 'bot-vale', name: 'Vale', image: null, isBot: true, tagline: 'Here for the deep cuts', topArtists: ['Bad Bunny', 'Young Miko', 'Karol G'] },
    ],
    messages: ['this beat switch is unreal', 'the whole album flows so well', 'adding this one to the weekend playlist'],
  },
  {
    id: 'artist:5YGY8feqx7naU7z4HrwZM6',
    artistId: '5YGY8feqx7naU7z4HrwZM6',
    name: 'Miley Cyrus',
    track: 'End of the World',
    bots: [
      { id: 'bot-jules', name: 'Jules', image: null, isBot: true, tagline: 'Pop hooks and long drives', topArtists: ['Miley Cyrus', 'Dua Lipa', 'Chappell Roan'] },
      { id: 'bot-remy', name: 'Remy', image: null, isBot: true, tagline: 'Playlist curator after dark', topArtists: ['Miley Cyrus', 'HAIM', 'Lorde'] },
    ],
    messages: ['that chorus belongs in a stadium', 'her vocals sound incredible here', 'okay this is going straight into favorites'],
  },
  {
    id: 'artist:7tYKF4w9nC0nq9CsPZTHyP',
    artistId: '7tYKF4w9nC0nq9CsPZTHyP',
    name: 'SZA',
    track: 'Saturn',
    bots: [
      { id: 'bot-aria', name: 'Aria', image: null, isBot: true, tagline: 'Headphones always on', topArtists: ['SZA', 'Frank Ocean', 'Solange'] },
      { id: 'bot-noah', name: 'Noah', image: null, isBot: true, tagline: 'Late-night R&B specialist', topArtists: ['SZA', 'Brent Faiyaz', 'Steve Lacy'] },
      { id: 'bot-iman', name: 'Iman', image: null, isBot: true, tagline: 'Collecting perfect bridges', topArtists: ['SZA', 'Doechii', 'Tems'] },
      { id: 'bot-kai', name: 'Kai', image: null, isBot: true, tagline: 'One more song before sleep', topArtists: ['SZA', 'Tyler, The Creator', 'Daniel Caesar'] },
    ],
    messages: ['the production feels weightless', 'this song at night is a different experience', 'SZA never misses on the bridge'],
  },
];

function createDemoMessage(room, index, offsetMinutes = 0) {
  const bot = room.bots[index % room.bots.length];
  return {
    id: crypto.randomUUID(),
    user: { ...bot, currentArtist: room.name, currentTrack: room.track },
    message: room.messages[index % room.messages.length],
    sentAt: new Date(Date.now() - offsetMinutes * 60_000).toISOString(),
    demo: true,
  };
}

function seedDemoHistory(addMessage) {
  DEMO_ROOMS.forEach((room) => {
    addMessage(room.id, createDemoMessage(room, 0, 18));
    addMessage(room.id, createDemoMessage(room, 1, 9));
    addMessage(room.id, createDemoMessage(room, 2, 3));
  });
}

function roomSummary(room, realUsers = 0) {
  return {
    id: room.id,
    artistId: room.artistId,
    name: room.name,
    listenerCount: room.bots.length + realUsers,
    participants: room.bots.map((bot) => ({
      ...bot,
      currentArtist: room.name,
      currentTrack: room.track,
    })),
  };
}

module.exports = { DEMO_ROOMS, createDemoMessage, roomSummary, seedDemoHistory };

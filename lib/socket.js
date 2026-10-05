const crypto = require('crypto');
const CircularBuffer = require('../CircularBuffer');
const {
  DEMO_ROOMS,
  createDemoMessage,
  roomSummary,
  seedDemoHistory,
} = require('./demoChats');
const { getAuthorizedSpotify, normalizePlayback } = require('./spotify');

const LOBBY = { id: 'lobby', name: 'The Lobby' };

function createChatServer(io) {
  const messageBuffers = new Map();

  function getHistory(roomId) {
    if (!messageBuffers.has(roomId)) {
      messageBuffers.set(roomId, new CircularBuffer(100));
    }
    return messageBuffers.get(roomId);
  }

  function addMessage(roomId, message) {
    getHistory(roomId).add(message);
  }

  function activeRooms() {
    const rooms = new Map();
    DEMO_ROOMS.forEach((room) => {
      const realUsers = io.sockets.adapter.rooms.get(room.id)?.size || 0;
      rooms.set(room.id, roomSummary(room, realUsers));
    });

    io.sockets.sockets.forEach((connectedSocket) => {
      const room = connectedSocket.data.room;
      if (!room) return;
      if (!rooms.has(room.id)) {
        rooms.set(room.id, {
          ...room,
          listenerCount: io.sockets.adapter.rooms.get(room.id)?.size || 0,
          participants: [],
        });
      }
      const summary = rooms.get(room.id);
      if (!summary.participants.some((profile) => profile.id === connectedSocket.data.profile.id)) {
        summary.participants.push({
          ...connectedSocket.data.profile,
          currentArtist: room.name,
          currentTrack: connectedSocket.data.playback?.track?.name || null,
        });
      }
    });

    return [...rooms.values()].sort((a, b) => b.listenerCount - a.listenerCount);
  }

  function broadcastActiveRooms() {
    io.emit('active_rooms', activeRooms());
  }

  async function joinRoom(socket, nextRoom, browsing = false) {
    if (socket.data.room?.id === nextRoom.id) {
      socket.data.browsing = browsing;
      socket.emit('room_changed', {
        room: nextRoom,
        messages: getHistory(nextRoom.id).getAll(),
        browsing,
      });
      return;
    }

    const previousRoom = socket.data.room;
    if (previousRoom) {
      await socket.leave(previousRoom.id);
      socket.to(previousRoom.id).emit('presence', {
        type: 'left',
        message: `${socket.data.profile.name} left ${previousRoom.name}`,
      });
    }

    await socket.join(nextRoom.id);
    socket.data.room = nextRoom;
    socket.data.browsing = browsing;
    socket.emit('room_changed', {
      room: nextRoom,
      messages: getHistory(nextRoom.id).getAll(),
      browsing,
    });
    socket.to(nextRoom.id).emit('presence', {
      type: 'joined',
      message: `${socket.data.profile.name} joined ${nextRoom.name}`,
    });
    broadcastActiveRooms();
  }

  async function moveToPlaybackRoom(socket, playback) {
    const artist = playback.track?.artists?.[0];
    const nextRoom = artist?.id
      ? { id: `artist:${artist.id}`, artistId: artist.id, name: artist.name }
      : LOBBY;

    const playbackRoomChanged = socket.data.listeningRoom?.id !== nextRoom.id;
    socket.data.listeningRoom = nextRoom;
    if (!socket.data.browsing || playbackRoomChanged) {
      await joinRoom(socket, nextRoom, false);
    }
  }

  async function syncPlayback(socket) {
    try {
      const spotify = await getAuthorizedSpotify(socket.request.session);
      const response = await spotify.getMyCurrentPlaybackState();
      const playback = normalizePlayback(response.body);
      socket.data.playback = playback;
      socket.request.session.save(() => {});
      socket.emit('playback', playback);
      await moveToPlaybackRoom(socket, playback);
    } catch (error) {
      socket.emit('spotify_error', {
        status: error.status || error.statusCode || 500,
        message: error.message || 'Could not sync Spotify playback',
      });
    }
  }

  io.use((socket, next) => {
    const auth = socket.request.session?.spotify;
    if (!auth?.profile) return next(new Error('Spotify account is not connected'));
    socket.data.profile = auth.profile;
    return next();
  });

  io.on('connection', (socket) => {
    socket.data.room = null;
    socket.data.browsing = false;
    socket.data.listeningRoom = LOBBY;
    syncPlayback(socket);
    const playbackInterval = setInterval(() => syncPlayback(socket), 7_500);

    socket.on('sync_playback', () => syncPlayback(socket));

    socket.on('browse_room', async (roomId) => {
      const summary = activeRooms().find((activeRoom) => activeRoom.id === roomId);
      if (!summary) return;
      await joinRoom(
        socket,
        { id: summary.id, artistId: summary.artistId, name: summary.name },
        true,
      );
    });

    socket.on('follow_playback', async () => {
      await joinRoom(socket, socket.data.listeningRoom || LOBBY, false);
    });

    socket.on('chat_message', (payload = {}, acknowledge) => {
      const room = socket.data.room;
      const text = String(payload.message || '').trim().slice(0, 500);
      if (!room || !text) {
        if (acknowledge) acknowledge({ ok: false });
        return;
      }

      const message = {
        id: crypto.randomUUID(),
        user: {
          id: socket.data.profile.id,
          name: socket.data.profile.name,
          image: socket.data.profile.image,
        },
        message: text,
        sentAt: new Date().toISOString(),
      };
      addMessage(room.id, message);
      io.to(room.id).emit('chat_message', message);
      if (acknowledge) acknowledge({ ok: true });
    });

    socket.on('disconnect', () => {
      clearInterval(playbackInterval);
      const room = socket.data.room;
      if (room) {
        socket.to(room.id).emit('presence', {
          type: 'left',
          message: `${socket.data.profile.name} left ${room.name}`,
        });
      }
      broadcastActiveRooms();
    });
  });

  seedDemoHistory(addMessage);
  const botInterval = setInterval(() => {
    const room = DEMO_ROOMS[Math.floor(Math.random() * DEMO_ROOMS.length)];
    const index = Math.floor(Math.random() * room.messages.length);
    const message = createDemoMessage(room, index);
    addMessage(room.id, message);
    io.to(room.id).emit('chat_message', message);
    broadcastActiveRooms();
  }, 18_000);
  botInterval.unref();

  return { activeRooms, messageBuffers };
}

module.exports = { createChatServer, LOBBY };

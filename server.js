require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');
const CircularBuffer = require('./CircularBuffer');
const { authenticateSocket, authenticateUser } = require("./middleware/authMiddleware");

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});

// Add body-parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: 'http://localhost:4200',
    credentials: true
}));

const spotifyApi = new (require('spotify-web-api-node'))({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

const messageBuffers = {};
global.users = {};

async function refreshAccessToken(refreshToken) {
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = response.data.access_token;
        spotifyApi.setAccessToken(accessToken);
        console.log('Access token refreshed');
        return accessToken;
    } catch (error) {
        console.error('Error refreshing access token', error);
        throw new Error('Error refreshing access token');
    }
}

async function getCurrentPlayback() {
    try {
        const currentPlayback = await spotifyApi.getMyCurrentPlaybackState();
        return currentPlayback.body;
    } catch (error) {
        throw new Error('Error getting current playback: ' + error.message);
    }
}

function setupSocketListeners(socket) {
    console.log("Setting up socket listeners");


    socket.on('get_current_song', async (artistName) => {
        try {
            const joinRoom = async (artist) => {
                socket.join(artist);
                socket.room = artist;
                console.log(`User ${socket.user.display_name} joined room: ${artist}`);
            };

            const emitCurrentSong = async () => {
                const currentPlayback = await getCurrentPlayback(socket.user.accessToken);
                const artistName = currentPlayback.item.artists[0].name;
                await joinRoom(artistName);
                io.to(socket.id).emit('current_song', {
                    song: currentPlayback.item.name,
                    artist: artistName,
                    user: socket.user
                });
            };

            console.log('getting current song')
            if (artistName) {
                await joinRoom(artistName);
            } else {
                await emitCurrentSong();
                checkSongInterval = setInterval(async () => {
                    try {
                        await emitCurrentSong();
                    } catch (error) {
                        console.error('Error emitting current song:', error);
                    }
                }, 5000);
            }

            if (!messageBuffers[socket.room]) {
                messageBuffers[socket.room] = new CircularBuffer(100);
            }

            const last100Messages = messageBuffers[socket.room].getAll();
            console.log(`Last 100 messages for room ${socket.room}:`, last100Messages);
            last100Messages.forEach((msg) => {
                socket.emit('chat_message', msg);
            });

            io.to(socket.room).emit('new_user', `${socket.user.display_name} joined ${socket.room} chat`);

            socket.on('disconnect', () => {
                console.log('Client disconnected');
                clearInterval(checkSongInterval);
                io.to(socket.room).emit('user_left', `${socket.user.display_name} left ${socket.room} chat`);
            });

            socket.on('chat_message', (payload) => {
                console.log(`Message received from ${socket.user.display_name}: ${payload.message}`);
                const userMessage = {
                    user: socket.user.display_name,
                    message: payload.message
                };

                messageBuffers[socket.room].add(userMessage);
                console.log(`Updated message buffer for room ${socket.room}:`, messageBuffers[socket.room].getAll());

                io.to(socket.room).emit('chat_message', userMessage);
            });
        } catch (error) {
            console.error('Error getting current song', error);
        }
    });
}

app.get('/login', (req, res) => {
    const scopes = ['user-read-playback-state', 'user-read-currently-playing'];
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
    res.json(authorizeURL);
});

app.get('/callback', async (req, res) => {
    console.log('Callback route hit');
    const code = req.query.code || null;

    if (!code) {
        return res.status(400).json({ error: 'Invalid code' });
    }

    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token } = data.body;

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);

        const user = await authenticateUser(access_token);
        const userId = user.id;

        global.users[userId] = { accessToken: access_token, refreshToken: refresh_token, userInfo: user };

        res.json({ userId, access_token, refresh_token });
    } catch (error) {
        console.error('Error during Spotify authorization:', error);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        res.status(500).json({ error: 'Authorization failed' });
    }
});

app.get('/refresh-token', async (req, res) => {
    const refreshToken = req.query.refresh_token;
    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    try {
        const accessToken = await refreshAccessToken(refreshToken);
        res.json({ accessToken });
    } catch (error) {
        res.status(500).json({ error: 'Failed to refresh access token' });
    }
});


io.use(authenticateSocket);


io.on('connection', (socket) => {
    console.log('A user connected:', socket.user.display_name);
    setupSocketListeners(socket);
});

const PORT = process.env.PORT || 4000;
const startServer = () => {
    return server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();

module.exports = { authenticateUser, getCurrentPlayback, setupSocketListeners, refreshAccessToken, startServer, server };

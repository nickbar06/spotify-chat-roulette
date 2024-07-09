require('dotenv').config();
const express = require('express');
const http = require('http');
const SpotifyWebApi = require('spotify-web-api-node');
const CircularBuffer = require('./CircularBuffer'); // Import the CircularBuffer class

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "*"
    }
});

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Store messages for each room using CircularBuffer with a size of 100
const messageBuffers = {}; 

// Refresh token logic
async function refreshAccessToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log('Access token refreshed');
    } catch (error) {
        console.error('Error refreshing access token', error);
        throw new Error('Error refreshing access token');
    }
}

function startRefreshTokenInterval() {
    refreshTokenInterval = setInterval(refreshAccessToken, 1000 * 60 * 30); // Refresh token every 30 minutes
}

function stopRefreshTokenInterval() {
    if (refreshTokenInterval) {
        clearInterval(refreshTokenInterval);
    }
}

async function authenticateUser(accessToken) {
    spotifyApi.setAccessToken(accessToken);
    try {
        const me = await spotifyApi.getMe();
        return me.body;
    } catch (error) {
        throw new Error('Authentication error: ' + error.message);
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
    socket.on('authenticate', async (accessToken) => {
        console.log('authenticate event received');
        try {
            const user = await authenticateUser(accessToken);
            socket.user = user;
            socket.emit('authenticated', user);
            console.log('User authenticated:', user.display_name);
        } catch (error) {
            socket.emit('authentication_error', error.message);
            console.error('Authentication error:', error.message);
        }
    });

    socket.on('get_current_song', async (artistName) => {
        try {
            if (artistName) {
                socket.join(artistName);
                socket.room = artistName;
                console.log(`User ${socket.user.display_name} joined room: ${artistName}`);
            } else {
                const currentPlayback = await getCurrentPlayback();
                const artistName = currentPlayback.item.artists[0].name;
                socket.join(artistName);
                socket.room = artistName;
                console.log(`User ${socket.user.display_name} joined room: ${artistName}`);
            }

            // Initialize message buffer if it doesn't exist
            if (!messageBuffers[artistName]) {
                messageBuffers[artistName] = new CircularBuffer(100);
            }

            // Send last 100 messages to the new user
            const last100Messages = messageBuffers[artistName].getAll();
            console.log(`Last 100 messages for room ${artistName}:`, last100Messages);
            last100Messages.forEach((msg) => {
                socket.emit('chat_message', msg);
            });

            io.to(artistName).emit('new_user', `${socket.user.display_name} joined ${artistName} chat`);

            socket.on('disconnect', () => {
                console.log('Client disconnected');
                io.to(artistName).emit('user_left', `${socket.user.display_name} left ${artistName} chat`);
            });

            socket.on('chat_message', (payload) => {
                console.log(`Message received from ${socket.user.display_name}: ${payload.message}`);
                const userMessage = {
                    user: socket.user.display_name,
                    message: payload.message
                };

                messageBuffers[artistName].add(userMessage);
                console.log(`Updated message buffer for room ${artistName}:`, messageBuffers[artistName].getAll());

                io.to(artistName).emit('chat_message', userMessage);
            });
        } catch (error) {
            console.error('Error getting current song', error);
        }
    });
}

app.get('/callback', async (req, res) => {
    console.log('Callback route hit');
    const code = req.query.code || null;
    console.log('Authorization code:', code);

    if (!code) {
        res.redirect('/#/error/invalid code');
        return;
    }

    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token } = data.body;

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);

        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);

        res.redirect(`http://localhost:3000/#access_token=${access_token}`);
    } catch (error) {
        console.error('Error during Spotify authorization:', error);
        res.redirect('/#/error/invalid token');
    }
});

io.on('connection', (socket) => {
    // console.log('New client connected');
    setupSocketListeners(socket);
});

const PORT = process.env.PORT || 4000;
const startServer = () => {
    startRefreshTokenInterval();
    return server.listen(PORT);
};

const stopServer = () => {
    stopRefreshTokenInterval();
    server.close();
};

module.exports = { authenticateUser, getCurrentPlayback, setupSocketListeners, refreshAccessToken, startServer, stopServer, server };

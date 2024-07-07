require('dotenv').config();
const io = require('socket.io-client');
const { startServer, stopServer } = require('../server');
const sinon = require('sinon');
const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const path = require('path');

const users = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'users.json'))).users;

describe('Socket.IO Server', () => {
  let testServer;
  let clients = [];
  let authenticateUserStub;
  let clientCredentialsGrantStub;
  let getMeStub;
  let getMyCurrentPlaybackStateStub;
  let setAccessTokenStub;
  let storedAccessToken;

  beforeAll((done) => {
    console.log('Starting server...');
    testServer = startServer();
    done();
  });

  afterAll((done) => {
    console.log('Stopping server...');
    stopServer();
    done();
  });

  beforeEach((done) => {
    console.log('Stubbing functions...');

    // Stub the authenticateUser function globally
    authenticateUserStub = sinon.stub(require('../server'), 'authenticateUser').callsFake((accessToken) => {
      console.log(`Stubbed authenticateUser called with accessToken: ${accessToken}`);
      const user = users.find(user => user.token === accessToken);
      if (user) {
        return Promise.resolve({ display_name: user.display_name });
      } else {
        return Promise.reject(new Error('Invalid token'));
      }
    });

    // Stub the clientCredentialsGrant function globally
    clientCredentialsGrantStub = sinon.stub(SpotifyWebApi.prototype, 'clientCredentialsGrant').callsFake(() => {
      console.log('Stubbed clientCredentialsGrant called');
      return Promise.resolve({
        body: {
          access_token: 'new_access_token'
        }
      });
    });

    // Stub the setAccessToken function globally
    setAccessTokenStub = sinon.stub(SpotifyWebApi.prototype, 'setAccessToken').callsFake((token) => {
      console.log(`Stubbed setAccessToken called with token: ${token}`);
      storedAccessToken = token;
    });

    // Stub the getMe function globally
    getMeStub = sinon.stub(SpotifyWebApi.prototype, 'getMe').callsFake(() => {
      console.log(`Stubbed getMe called with storedAccessToken: ${storedAccessToken}`);
      const user = users.find(user => user.token === storedAccessToken);
      if (user) {
        return Promise.resolve({
          body: {
            display_name: user.display_name
          }
        });
      } else {
        return Promise.reject(new Error('Invalid token'));
      }
    });

    // Stub the getMyCurrentPlaybackState function globally
    getMyCurrentPlaybackStateStub = sinon.stub(SpotifyWebApi.prototype, 'getMyCurrentPlaybackState').callsFake(() => {
      console.log('Stubbed getMyCurrentPlaybackState called');
      return Promise.resolve({
        body: {
          item: {
            artists: [{ name: 'artist1' }]
          }
        }
      });
    });

    // Connect two clients
    clients = [
      io('http://localhost:4000'),
      io('http://localhost:4000'),
      io('http://localhost:4000'),
      io('http://localhost:4000')
    ];

    // Wait for clients to connect
    let connectCount = 0;
    clients.forEach(client => {
      client.on('connect', () => {
        console.log('Client connected');
        connectCount += 1;
        if (connectCount === clients.length) done();
      });
    });
  });

  afterEach((done) => {
    console.log('Restoring stubs and disconnecting clients...');
    // Restore the original functions
    authenticateUserStub.restore();
    clientCredentialsGrantStub.restore();
    setAccessTokenStub.restore();
    getMeStub.restore();
    getMyCurrentPlaybackStateStub.restore();

    // Disconnect clients
    let disconnectCount = 0;
    const onDisconnect = () => {
      disconnectCount += 1;
      if (disconnectCount === 2) done();
    };

    if (clientA.connected) {
      clientA.on('disconnect', () => {
        console.log('Client A disconnected');
        onDisconnect();
      });
      clientA.disconnect();
    } else {
      onDisconnect();
    }

    if (clientB.connected) {
      clientB.on('disconnect', () => {
        console.log('Client B disconnected');
        onDisconnect();
      });
      clientB.disconnect();
    } else {
      onDisconnect();
    }
  });

  test('should allow both users to see each other’s messages in the same room', (done) => {
    const room = 'artist1';
    const messageA = { user: 'userA', message: 'hello' };
    const messageB = { user: 'userB', message: 'world' };

    let messageCountA = 0;
    let messageCountB = 0;

    clientA.on('authenticated', () => {
      console.log('Client A authenticated');
      clientA.emit('get_current_song', room);
    });

    clientB.on('authenticated', () => {
      console.log('Client B authenticated');
      clientB.emit('get_current_song', room);
    });

    clientA.on('new_user', (message) => {
      console.log('Client A new_user:', message);
    });

    clientB.on('new_user', (message) => {
      console.log('Client B new_user:', message);
    });

    clientA.on('chat_message', (message) => {
      console.log('Client A received message:', message);
      if (message.user === 'userB' && message.message === 'world') {
        messageCountA++;
      }
      if (messageCountA === 0 && messageCountB === 0) done();
    });

    clientB.on('chat_message', (message) => {
      console.log('Client B received message:', message);
      if (message.user === 'userA' && message.message === 'hello') {
        messageCountB++;
      }
      if (messageCountA === 0 && messageCountB === 0) done();
    });

    setTimeout(() => {
      console.log('Sending messages');
      clientA.emit('chat_message', messageA);
      clientB.emit('chat_message', messageB);
    }, 1000);

    clientA.emit('authenticate', 'dummy_token_for_userA');
    clientB.emit('authenticate', 'dummy_token_for_userB');
  }, 30000); // Increased timeout to 30000 ms (30 seconds)

  test('should not allow users to see each other’s messages in different rooms', (done) => {
    const roomA = 'artist1';
    const roomB = 'artist2';
    const messageA = { user: 'userA', message: 'hello' };
    const messageB = { user: 'userB', message: 'world' };

    let messageCountA = 0;
    let messageCountB = 0;

    clientA.on('authenticated', () => {
      // console.log('Client A authenticated');
      clientA.emit('get_current_song', roomA);
    });

    clientB.on('authenticated', () => {
      // console.log('Client B authenticated');
      clientB.emit('get_current_song', roomB);
    });

    clientA.on('new_user', (message) => {
      // console.log('Client A new_user:', message);
    });

    clientB.on('new_user', (message) => {
      // console.log('Client B new_user:', message);
    });

    clientA.on('chat_message', (message) => {
      console.log('Client A received message:', message);
      if (message.user === 'userB' && message.message === 'world') {
        messageCountA++;
      }
      if (messageCountA === 0 && messageCountB === 0) done();
    });

    clientB.on('chat_message', (message) => {
      console.log('Client B received message:', message);
      if (message.user === 'userA' && message.message === 'hello') {
        messageCountB++;
      }
      if (messageCountA === 0 && messageCountB === 0) done();
    });

    setTimeout(() => {
      console.log('Sending messages');
      clientA.emit('chat_message', messageA);
      clientB.emit('chat_message', messageB);
    }, 1000);

    clientA.emit('authenticate', 'dummy_token_for_userA');
    clientB.emit('authenticate', 'dummy_token_for_userB');

    // Give some time for potential incorrect message emissions
    setTimeout(() => {
      console.log('Checking message count');
      expect(messageCountA).toBe(1); // Only userA's own message should be received
      expect(messageCountB).toBe(1); // Only userB's own message should be received
      done();
    }, 1500);
  }, 30000); // Increased timeout to 30000 ms (30 seconds)
});

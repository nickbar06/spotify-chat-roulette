const io = require('socket.io-client');
const { startServer, stopServer, authenticateUser } = require('../server');
const sinon = require('sinon');

describe('Socket.IO Server', () => {
  let testServer;
  let clientA, clientB;
  let authenticateUserStub;

  beforeAll((done) => {
    testServer = startServer();
    done();
  });

  afterAll((done) => {
    stopServer();
    done();
  });

  beforeEach(() => {
    // Stub the authenticateUser function globally
    authenticateUserStub = sinon.stub(require('../server'), 'authenticateUser').callsFake((accessToken) => {
      if (accessToken === 'dummy_token_for_userA') {
        return Promise.resolve({ display_name: 'userA' });
      } else if (accessToken === 'dummy_token_for_userB') {
        return Promise.resolve({ display_name: 'userB' });
      } else {
        return Promise.reject(new Error('Invalid token'));
      }
    });

    // Connect two clients
    clientA = io('http://localhost:4000');
    clientB = io('http://localhost:4000');
  });

  afterEach(() => {
    // Restore the original authenticateUser function
    authenticateUserStub.restore();

    // Disconnect clients
    if (clientA.connected) clientA.disconnect();
    if (clientB.connected) clientB.disconnect();
  });

  test('should allow both users to see each other’s messages in the same room', (done) => {
    const room = 'artist1';
    const messageA = { user: 'userA', message: 'hello' };
    const messageB = { user: 'userB', message: 'world' };

    let messageCount = 0;

    clientA.on('connect', () => {
      console.log('Client A connected');
      clientA.emit('authenticate', 'dummy_token_for_userA');
    });

    clientB.on('connect', () => {
      console.log('Client B connected');
      clientB.emit('authenticate', 'dummy_token_for_userB');
    });

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
      expect(message).toEqual(messageB);
      messageCount++;
      if (messageCount === 2) done();
    });

    clientB.on('chat_message', (message) => {
      console.log('Client B received message:', message);
      expect(message).toEqual(messageA);
      messageCount++;
      if (messageCount === 2) done();
    });

    setTimeout(() => {
      console.log('Sending messages');
      clientA.emit('chat_message', messageA);
      clientB.emit('chat_message', messageB);
    }, 1000);
  }, 20000);

  test('should not allow users to see each other’s messages in different rooms', (done) => {
    const roomA = 'artist1';
    const roomB = 'artist2';
    const messageA = { user: 'userA', message: 'hello' };
    const messageB = { user: 'userB', message: 'world' };

    let messageCount = 0;

    clientA.on('connect', () => {
      console.log('Client A connected');
      clientA.emit('authenticate', 'dummy_token_for_userA');
    });

    clientB.on('connect', () => {
      console.log('Client B connected');
      clientB.emit('authenticate', 'dummy_token_for_userB');
    });

    clientA.on('authenticated', () => {
      console.log('Client A authenticated');
      clientA.emit('get_current_song', roomA);
    });

    clientB.on('authenticated', () => {
      console.log('Client B authenticated');
      clientB.emit('get_current_song', roomB);
    });

    clientA.on('new_user', (message) => {
      console.log('Client A new_user:', message);
    });

    clientB.on('new_user', (message) => {
      console.log('Client B new_user:', message);
    });

    clientA.on('chat_message', (message) => {
      console.log('Client A received message:', message);
      expect(message).toEqual(messageA);
      messageCount++;
      if (messageCount === 2) done();
    });

    clientB.on('chat_message', (message) => {
      console.log('Client B received message:', message);
      expect(message).toEqual(messageB);
      messageCount++;
      if (messageCount === 2) done();
    });

    setTimeout(() => {
      console.log('Sending messages');
      clientA.emit('chat_message', messageA);
      clientB.emit('chat_message', messageB);
    }, 1000);

    // Give some time for potential incorrect message emissions
    setTimeout(() => {
      console.log('Checking message count');
      expect(messageCount).toBe(2);
      done();
    }, 1500);
  }, 20000);
});

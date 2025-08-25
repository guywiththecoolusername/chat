// server.js
// Minimal WebSocket relay for E2EE chat.
// It does not know any keys or plaintext — only relays ciphertext.

const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Map of roomId => Set<WebSocket>
const rooms = new Map();

function joinRoom(ws, roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);
  ws._roomId = roomId;
}

function leaveRoom(ws) {
  const roomId = ws._roomId;
  if (!roomId) return;
  const set = rooms.get(roomId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(roomId);
  }
  ws._roomId = null;
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join' && typeof msg.roomId === 'string') {
        joinRoom(ws, msg.roomId);
        ws.send(JSON.stringify({ type: 'joined', roomId: msg.roomId }));

      } else if (msg.type === 'msg' && ws._roomId) {
        // Broadcast ciphertext payload to everyone else in the room
        const peers = rooms.get(ws._roomId) || new Set();
        for (const peer of peers) {
          if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify({ type: 'msg', payload: msg.payload }));
          }
        }
      }
    } catch (e) {
      // ignore malformed messages
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

console.log(`Relay server listening on port ${PORT}`);

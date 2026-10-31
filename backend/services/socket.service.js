let ioInstance = null;

/**
 * Socket.io Service to broadcast real-time pipeline events to React clients
 */
const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.emit('connection:ack', {
      message: 'Connected to OrderFlow Sentinel Live Stream',
      timestamp: new Date().toISOString()
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};

const emitEvent = (eventName, payload) => {
  if (ioInstance) {
    ioInstance.emit(eventName, {
      ...payload,
      emittedAt: new Date().toISOString()
    });
  }
};

module.exports = {
  initSocket,
  emitEvent
};

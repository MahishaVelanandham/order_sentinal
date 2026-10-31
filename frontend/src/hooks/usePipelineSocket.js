import { useEffect, useState } from 'react';
import { getSocket } from '../services/socket';

export const usePipelineSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState(null);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleOrderCreated = (data) => {
      setLatestEvent({ type: 'order:created', data, timestamp: new Date() });
    };

    const handleOrderHealed = (data) => {
      setLatestEvent({ type: 'order:healed', data, timestamp: new Date() });
    };

    const handleOrderEscalated = (data) => {
      setLatestEvent({ type: 'order:escalated', data, timestamp: new Date() });
    };

    const handleRemediationRejected = (data) => {
      setLatestEvent({ type: 'remediation:rejected', data, timestamp: new Date() });
    };

    const handleRemediationApproved = (data) => {
      setLatestEvent({ type: 'remediation:approved', data, timestamp: new Date() });
    };

    const handleChaosUpdated = (data) => {
      setLatestEvent({ type: 'chaos:updated', data, timestamp: new Date() });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('order:created', handleOrderCreated);
    socket.on('order:healed', handleOrderHealed);
    socket.on('order:escalated', handleOrderEscalated);
    socket.on('remediation:rejected', handleRemediationRejected);
    socket.on('remediation:approved', handleRemediationApproved);
    socket.on('chaos:updated', handleChaosUpdated);

    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('order:created', handleOrderCreated);
      socket.off('order:healed', handleOrderHealed);
      socket.off('order:escalated', handleOrderEscalated);
      socket.off('remediation:rejected', handleRemediationRejected);
      socket.off('remediation:approved', handleRemediationApproved);
      socket.off('chaos:updated', handleChaosUpdated);
    };
  }, []);

  return { isConnected, latestEvent };
};

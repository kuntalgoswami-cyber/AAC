import React, { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useSecurityStore } from '../store';
import { toast } from 'sonner';

let socket: any = null;

export function useSocket() {
  const { token, setSocketConnected, addLog, setHitlQueue, logout } = useSecurityStore();

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }

    if (!socket) {
      socket = io(window.location.origin, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        setSocketConnected(true);
        toast.success('Connected to SOC Telemetry Stream');
      });

      socket.on('disconnect', (reason) => {
        setSocketConnected(false);
        if (reason === 'io server disconnect') {
          // the disconnection was initiated by the server, you need to reconnect manually
          socket?.connect();
        }
      });

      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        if (err.message === 'Authentication error' || err.message === 'Token revoked') {
          toast.error('Session expired. Please log in again.');
          logout();
        }
      });

      socket.on('new_log', (log) => {
        addLog(log);
      });

      socket.on('hitl_update', (queue) => {
        setHitlQueue(queue);
      });
    }

    return () => {
      // Don't disconnect on unmount, keep the singleton alive as long as we have a token
    };
  }, [token, setSocketConnected, addLog, setHitlQueue, logout]);

  return { socket };
}

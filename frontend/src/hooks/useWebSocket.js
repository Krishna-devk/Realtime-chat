import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../store/useChatStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export const useWebSocket = (token) => {
  const socketRef = useRef(null);
  const addMessage = useChatStore((state) => state.addMessage);

  const connect = useCallback(() => {
    if (!token || (socketRef.current && socketRef.current.readyState === WebSocket.OPEN)) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket Connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_MESSAGE') {
        addMessage(data.room_id, {
          ...data,
          status: 'delivered'
        });
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected. Reconnecting...');
      setTimeout(connect, 3000);
    };

    socketRef.current = ws;
  }, [token, addMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = (roomId, content) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const clientMsgId = crypto.randomUUID();
      const messageData = {
        type: 'SEND_MESSAGE',
        room_id: roomId,
        content,
        client_msg_id: clientMsgId,
      };
      
      socketRef.current.send(JSON.stringify(messageData));
      
      // Optimistic update
      addMessage(roomId, {
        id: 'temp-' + clientMsgId,
        client_msg_id: clientMsgId,
        room_id: roomId,
        sender_id: 'me',
        content,
        created_at: new Date().toISOString(),
        status: 'sending'
      });
    }
  };

  return { sendMessage };
};

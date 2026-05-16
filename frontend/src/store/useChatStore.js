import { create } from 'zustand';

export const useChatStore = create((set) => ({
  rooms: [],
  activeRoomId: null,
  messages: {}, // room_id -> messages
  currentUser: null,

  setRooms: (rooms) => set({ rooms }),
  setActiveRoom: (activeRoomId) => set({ activeRoomId }),
  addMessage: (roomId, message) => set((state) => {
    const roomMessages = state.messages[roomId] || [];
    return {
      messages: {
        ...state.messages,
        [roomId]: [...roomMessages, message],
      },
    };
  }),
  updateMessageStatus: (roomId, clientMsgId, status) => set((state) => {
    const roomMessages = state.messages[roomId] || [];
    const updatedMessages = roomMessages.map((msg) =>
      msg.client_msg_id === clientMsgId ? { ...msg, status } : msg
    );
    return {
      messages: {
        ...state.messages,
        [roomId]: updatedMessages,
      },
    };
  }),
  setCurrentUser: (currentUser) => set({ currentUser }),
  updateCurrentUser: (updates) => set((state) => ({
    currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null
  })),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    set({ currentUser: null, activeRoomId: null, rooms: [], messages: {} });
  },
}));

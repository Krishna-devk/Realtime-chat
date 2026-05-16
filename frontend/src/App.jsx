import React, { useState, useEffect } from 'react';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ChatInterface from './components/chat/ChatInterface';
import { useChatStore } from './store/useChatStore';
import api from './api/axios';

function App() {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [loading, setLoading] = useState(true);
  const currentUser = useChatStore((state) => state.currentUser);
  const setCurrentUser = useChatStore((state) => state.setCurrentUser);
  const setRooms = useChatStore((state) => state.setRooms);

  useEffect(() => {
    const initAuth = async () => {
      // Ping backend once at startup
      try {
        await api.get('/health', { baseURL: 'http://localhost:8000' }); // Direct ping to root health
        console.log('✅ Backend is online and responding.');
      } catch (err) {
        console.warn('⚠️ Backend ping failed, server might be starting up...', err);
      }

      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setCurrentUser(response.data);
        } catch (err) {
          console.error('Failed to recover session:', err);
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
        }
      }
      setLoading(false);
    };

    initAuth();
    
    // Initial dummy rooms for UI testing
    setRooms([
      { id: '1', name: 'General Support', is_group: true, last_message: { content: 'Welcome to the system!' } },
      { id: '2', name: 'Dev Team', is_group: true, last_message: { content: 'Build successful' } },
      { id: '3', name: 'Design Review', is_group: false, last_message: { content: 'Check the new mocks' } },
    ]);
  }, [setCurrentUser, setRooms]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <style jsx>{`
          .loading-screen {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #F5FAFF;
          }
          .loader {
            width: 40px;
            height: 40px;
            border: 3px solid #e1e1e1;
            border-top: 3px solid #25D366;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    return authMode === 'login' ? (
      <Login onToggleAuth={() => setAuthMode('signup')} />
    ) : (
      <Signup onToggleAuth={() => setAuthMode('login')} />
    );
  }

  return <ChatInterface />;
}

export default App;

import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, MoreVertical, Paperclip, Smile, Check, CheckCheck, Settings as SettingsIcon } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import Settings from '../account/Settings';

const ChatInterface = () => {
  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const { rooms, activeRoomId, messages, currentUser, setActiveRoom } = useChatStore();
  const token = localStorage.getItem('token');
  const { sendMessage } = useWebSocket(token);
  const messagesEndRef = useRef(null);

  const activeMessages = activeRoomId ? messages[activeRoomId] || [] : [];
  const activeRoom = rooms.find(r => r.id === activeRoomId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeRoomId) return;
    sendMessage(activeRoomId, inputText);
    setInputText('');
  };

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="avatar" onClick={() => setShowSettings(true)}>
            {currentUser?.display_name?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase()}
          </div>
          <div className="header-actions">
            <button onClick={() => setShowSettings(true)} className="icon-btn">
              <SettingsIcon size={20} color="#666" />
            </button>
            <MoreVertical size={20} color="#666" />
          </div>
        </div>
        <div className="search-bar">
          <div className="search-input-wrapper">
            <Search size={18} color="#888" />
            <input type="text" placeholder="Search or start new chat" />
          </div>
        </div>
        <div className="room-list">
          {rooms.map(room => (
            <div 
              key={room.id} 
              className={`room-item ${activeRoomId === room.id ? 'active' : ''}`}
              onClick={() => setActiveRoom(room.id)}
            >
              <div className="room-avatar">{room.name[0]}</div>
              <div className="room-info">
                <div className="room-name-time">
                  <span className="name">{room.name}</span>
                  <span className="time">12:45 PM</span>
                </div>
                <div className="last-message">
                  {room.last_message?.content || 'No messages yet'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="main-chat">
        {activeRoomId ? (
          <>
            <div className="chat-header">
              <div className="room-avatar">{activeRoom?.name[0]}</div>
              <div className="header-info">
                <h3>{activeRoom?.name}</h3>
                <p>online</p>
              </div>
              <div className="header-actions">
                <Search size={20} color="#666" />
                <MoreVertical size={20} color="#666" />
              </div>
            </div>

            <div className="messages-area">
              {activeMessages.map((msg, index) => (
                <div key={msg.id} className={`message-wrapper ${String(msg.sender_id) === String(currentUser?.id) ? 'sent' : 'received'}`}>
                  <div className="message-bubble">
                    <p>{msg.content}</p>
                    <div className="message-meta">
                      <span>12:45 PM</span>
                      {msg.sender_id === currentUser?.id && (
                        <div className="status-icon">
                          {msg.status === 'sending' ? <Check size={14} color="#aaa" /> : <CheckCheck size={14} color="#4fc3f7" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="input-area" onSubmit={handleSend}>
              <div className="input-actions">
                <Smile size={24} color="#666" />
                <Paperclip size={24} color="#666" />
              </div>
              <input 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message" 
              />
              <button type="submit" disabled={!inputText.trim()}>
                <Send size={24} color={inputText.trim() ? '#25D366' : '#666'} />
              </button>
            </form>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-content">
              <div className="logo-placeholder">P</div>
              <h2>Precision for Desktop</h2>
              <p>Send and receive messages without keeping your phone online.<br/>Use Precision on up to 4 linked devices and 1 phone at the same time.</p>
            </div>
          </div>
        )}
      </div>

      {showSettings && <Settings onBack={() => setShowSettings(false)} />}

      <style jsx>{`
        .chat-layout {
          display: flex;
          height: 100vh;
          background: #f0f2f5;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
        }
        .sidebar {
          width: 35%;
          min-width: 300px;
          max-width: 450px;
          background: white;
          border-right: 1px solid #e1e1e1;
          display: flex;
          flex-direction: column;
        }
        .sidebar-header {
          padding: 10px 16px;
          background: #f0f2f5;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .avatar {
          width: 40px;
          height: 40px;
          background: #25D366;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .avatar:hover {
          transform: scale(1.05);
        }
        .icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .icon-btn:hover {
          background: rgba(0,0,0,0.05);
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .search-bar {
          padding: 8px 12px;
          background: white;
        }
        .search-input-wrapper {
          background: #f0f2f5;
          border-radius: 8px;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .search-input-wrapper input {
          border: none;
          background: transparent;
          width: 100%;
          font-size: 14px;
          padding: 4px 0;
        }
        .search-input-wrapper input:focus { outline: none; }
        
        .room-list {
          flex: 1;
          overflow-y: auto;
        }
        .room-item {
          padding: 12px 16px;
          display: flex;
          gap: 12px;
          cursor: pointer;
          transition: background 0.1s;
          border-bottom: 1px solid #f5f5f5;
        }
        .room-item:hover { background: #f5f6f6; }
        .room-item.active { background: #ebebeb; }
        .room-avatar {
          width: 48px;
          height: 48px;
          background: #dfe5e7;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: #54656f;
        }
        .room-info {
          flex: 1;
          min-width: 0;
        }
        .room-name-time {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .room-name-time .name { font-weight: 500; color: #111b21; }
        .room-name-time .time { font-size: 12px; color: #667781; }
        .last-message {
          font-size: 13px;
          color: #667781;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .main-chat {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #efeae2;
          position: relative;
        }
        .chat-header {
          padding: 10px 16px;
          background: #f0f2f5;
          display: flex;
          align-items: center;
          gap: 12px;
          border-left: 1px solid #e1e1e1;
        }
        .header-info h3 { font-size: 16px; color: #111b21; margin: 0; }
        .header-info p { font-size: 13px; color: #667781; margin: 0; }
        .header-actions { margin-left: auto; display: flex; gap: 20px; }

        .messages-area {
          flex: 1;
          padding: 20px 5%;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .message-wrapper {
          display: flex;
          margin-bottom: 2px;
        }
        .message-wrapper.sent { justify-content: flex-end; }
        .message-wrapper.received { justify-content: flex-start; }
        
        .message-bubble {
          max-width: 65%;
          padding: 6px 10px 8px;
          border-radius: 8px;
          font-size: 14.5px;
          position: relative;
          box-shadow: 0 1px 0.5px rgba(0,0,0,0.1);
        }
        .sent .message-bubble { background: #d9fdd3; border-top-right-radius: 0; }
        .received .message-bubble { background: #ffffff; border-top-left-radius: 0; }
        
        .message-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 4px;
          font-size: 11px;
          color: #667781;
        }

        .input-area {
          padding: 10px 16px;
          background: #f0f2f5;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .input-actions { display: flex; gap: 16px; }
        .input-area input {
          flex: 1;
          background: white;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 15px;
        }
        .input-area input:focus { outline: none; }
        .input-area button { background: transparent; border: none; cursor: pointer; padding: 4px; }
        .input-area button:disabled { opacity: 0.5; }

        .empty-state {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: #f8f9fa;
          border-bottom: 6px solid #25D366;
        }
        .logo-placeholder {
          width: 80px;
          height: 80px;
          background: #e9edef;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          font-weight: 800;
          color: #adb5bd;
          margin: 0 auto 24px;
        }
        .empty-content h2 { color: #41525d; font-weight: 300; margin-bottom: 12px; }
        .empty-content p { color: #667781; font-size: 14px; line-height: 20px; }
      `}</style>
    </div>
  );
};

export default ChatInterface;

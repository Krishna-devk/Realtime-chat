import React, { useState } from 'react';
import api from '../../api/axios';
import { useChatStore } from '../../store/useChatStore';
import { User, Lock, Trash2, Camera, ChevronLeft, CheckCircle } from 'lucide-react';

const Settings = ({ onBack }) => {
  const currentUser = useChatStore((state) => state.currentUser);
  const updateCurrentUser = useChatStore((state) => state.updateCurrentUser);
  const logout = useChatStore((state) => state.logout);
  
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.patch('/auth/profile', {
        display_name: displayName,
        bio: bio
      });
      updateCurrentUser(response.data);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      setOldPassword('');
      setNewPassword('');
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Password change failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you absolutely sure? This action cannot be undone.')) {
      try {
        await api.delete('/auth/account');
        logout();
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to delete account' });
      }
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <button onClick={onBack} className="back-btn">
            <ChevronLeft size={24} />
          </button>
          <h2>Account Settings</h2>
        </div>

        <div className="settings-content">
          {message.text && (
            <div className={`status-banner ${message.type}`}>
              {message.type === 'success' && <CheckCircle size={18} />}
              {message.text}
            </div>
          )}

          <section className="settings-section">
            <div className="section-title">
              <User size={20} />
              <h3>Personal Info</h3>
            </div>
            <form onSubmit={handleUpdateProfile}>
              <div className="avatar-placeholder">
                <div className="avatar-circle">
                  {currentUser?.username?.[0]?.toUpperCase()}
                  <div className="avatar-edit">
                    <Camera size={16} />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Display Name</label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  placeholder="Your Name"
                />
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  placeholder="Tell us about yourself..."
                />
              </div>
              <button type="submit" className="save-btn" disabled={loading}>
                Save Profile
              </button>
            </form>
          </section>

          <section className="settings-section">
            <div className="section-title">
              <Lock size={20} />
              <h3>Security</h3>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Current Password</label>
                <input 
                  type="password" 
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)} 
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required
                />
              </div>
              <button type="submit" className="save-btn" disabled={loading}>
                Update Password
              </button>
            </form>
          </section>

          <section className="settings-section danger-zone">
            <div className="section-title">
              <Trash2 size={20} />
              <h3>Danger Zone</h3>
            </div>
            <p>Once you delete your account, there is no going back. Please be certain.</p>
            <button onClick={handleDeleteAccount} className="delete-btn">
              Delete My Account
            </button>
          </section>
          
          <button onClick={logout} className="logout-btn">
            Sign Out
          </button>
        </div>
      </div>

      <style jsx>{`
        .settings-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .settings-panel {
          background: white;
          width: 100%;
          max-width: 500px;
          height: 90vh;
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .settings-header {
          padding: 24px;
          border-bottom: 1px solid #eee;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .settings-header h2 {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
        }
        .back-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
          padding: 4px;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .back-btn:hover {
          background: #f5f5f5;
        }
        .settings-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .settings-section {
          margin-bottom: 40px;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          color: #1a1a1a;
        }
        .section-title h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .avatar-placeholder {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }
        .avatar-circle {
          width: 80px;
          height: 80px;
          background: #25D366;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 700;
          position: relative;
        }
        .avatar-edit {
          position: absolute;
          bottom: 0;
          right: 0;
          background: #1a1a1a;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #666;
          margin-bottom: 8px;
        }
        input, textarea {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e1e1e1;
          border-radius: 10px;
          font-size: 15px;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        textarea {
          height: 100px;
          resize: none;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #25D366;
          box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.1);
        }
        .save-btn {
          width: 100%;
          padding: 12px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .save-btn:active {
          transform: scale(0.98);
        }
        .danger-zone {
          padding: 20px;
          background: #fff5f5;
          border-radius: 12px;
          border: 1px solid #ffebeb;
        }
        .danger-zone p {
          font-size: 14px;
          color: #666;
          margin-bottom: 16px;
        }
        .delete-btn {
          color: #ff4444;
          background: none;
          border: 1px solid #ff4444;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .delete-btn:hover {
          background: #ff4444;
          color: white;
        }
        .logout-btn {
          width: 100%;
          padding: 16px;
          background: #f5f5f5;
          color: #666;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 20px;
        }
        .status-banner {
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 24px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .success {
          background: #f0fff4;
          color: #25D366;
          border: 1px solid #e6ffed;
        }
        .error {
          background: #fff5f5;
          color: #ff4444;
          border: 1px solid #ffebeb;
        }
      `}</style>
    </div>
  );
};

export default Settings;

import React, { createContext, useContext, useState } from 'react';
import { loginUser, signupUser } from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Try to load persisted user state
    const saved = localStorage.getItem('blitzcart_user') || localStorage.getItem('vibe_user');
    return saved ? JSON.parse(saved) : null;
  });

  const saveAuthSession = (data, userData) => {
    if (data.access_token) {
      localStorage.setItem('blitzcart_token', data.access_token);
      localStorage.setItem('vibe_token', data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem('blitzcart_refresh_token', data.refresh_token);
      localStorage.setItem('vibe_refresh_token', data.refresh_token);
    }
    localStorage.setItem('blitzcart_user', JSON.stringify(userData));
    localStorage.setItem('vibe_user', JSON.stringify(userData));
    setUser(userData);
  };

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    const userData = data.user || {
      name: email.split('@')[0].toUpperCase(),
      email: email,
    };
    saveAuthSession(data, userData);
    return { success: true };
  };

  const signup = async (name, email, password) => {
    const data = await signupUser(name, email, password);
    const userData = data.user || { name, email };
    saveAuthSession(data, userData);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    // Explicitly wipe all access tokens, refresh tokens, and persisted sessions
    localStorage.removeItem('blitzcart_user');
    localStorage.removeItem('blitzcart_token');
    localStorage.removeItem('blitzcart_refresh_token');
    localStorage.removeItem('vibe_user');
    localStorage.removeItem('vibe_token');
    localStorage.removeItem('vibe_refresh_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

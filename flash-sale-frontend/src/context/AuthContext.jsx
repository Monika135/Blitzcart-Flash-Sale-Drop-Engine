import React, { createContext, useContext, useState } from 'react';
import { loginUser, signupUser } from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Try to load persisted user state
    const saved = localStorage.getItem('vibe_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    if (data.access_token) {
      localStorage.setItem('vibe_token', data.access_token);
      localStorage.setItem('vibe_refresh_token', data.refresh_token);
    }
    
    const userData = data.user || {
      name: email.split('@')[0].toUpperCase(),
      email: email,
    };
    
    setUser(userData);
    localStorage.setItem('vibe_user', JSON.stringify(userData));
    return { success: true };
  };

  const signup = async (name, email, password) => {
    const data = await signupUser(name, email, password);
    if (data.access_token) {
      localStorage.setItem('vibe_token', data.access_token);
      localStorage.setItem('vibe_refresh_token', data.refresh_token);
    }

    const userData = data.user || { name, email };
    
    setUser(userData);
    localStorage.setItem('vibe_user', JSON.stringify(userData));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
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

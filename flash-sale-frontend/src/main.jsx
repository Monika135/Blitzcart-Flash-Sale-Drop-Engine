import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ReservationProvider } from './context/ReservationContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ReservationProvider>
          <App />
        </ReservationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

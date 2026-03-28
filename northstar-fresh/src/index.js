import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { PlayersProvider } from './contexts/PlayersContext';
import { CourseProvider } from './contexts/CourseContext';
import { TournamentProvider } from './contexts/TournamentContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <PlayersProvider>
        <CourseProvider>
          <TournamentProvider>
            <App />
          </TournamentProvider>
        </CourseProvider>
      </PlayersProvider>
    </AuthProvider>
  </React.StrictMode>
);

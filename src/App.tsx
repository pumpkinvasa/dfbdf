import React from 'react';
import { ThemeContextProvider } from './ThemeContext';
import HomePage from './pages/HomePage';
import { CssBaseline } from '@mui/material';

const App: React.FC = () => {
  return (
    <ThemeContextProvider>
      <CssBaseline />
      <HomePage />
    </ThemeContextProvider>
  );
};

export default App;
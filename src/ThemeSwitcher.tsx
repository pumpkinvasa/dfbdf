import React, { useContext } from 'react';
import { IconButton } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4'; 
import Brightness7Icon from '@mui/icons-material/Brightness7'; 
import { ThemeContext } from './ThemeContext';

const ThemeSwitcher: React.FC = () => {
  const { themeMode, toggleTheme } = useContext(ThemeContext);

  return (
    <IconButton color="inherit" onClick={toggleTheme}>
      {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
    </IconButton>
  );
};

export default ThemeSwitcher;
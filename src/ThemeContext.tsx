import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { baselightTheme, baseDarkTheme } from './theme';

// Типы тем
export type ThemeMode = 'light' | 'dark';

// Интерфейс контекста темы
interface ThemeContextInterface {
  toggleTheme: () => void;
  themeMode: ThemeMode;
}

// Интерфейс props провайдера
interface ThemeContextProviderProps {
  children: ReactNode;
}

// Создаем контекст для темы с дефолтными значениями
export const ThemeContext = createContext<ThemeContextInterface>({
  toggleTheme: () => {},
  themeMode: 'light',
});

// Провайдер для управления темой
export const ThemeContextProvider: React.FC<ThemeContextProviderProps> = ({ children }) => {
  // Получаем тему из localStorage при инициализации
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    (localStorage.getItem('themeMode') as ThemeMode) || 'light'
  );

  // Эффект для сохранения выбранной темы в localStorage
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Функция переключения темы
  const toggleTheme = (): void => {
    setThemeMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // Определяем, какую тему использовать
  const theme = themeMode === 'light' ? baselightTheme : baseDarkTheme;

  return (
    <ThemeContext.Provider value={{ toggleTheme, themeMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeContextProvider;
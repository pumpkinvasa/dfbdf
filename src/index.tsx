import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Находим элемент root в HTML
const container = document.getElementById('root');

// Проверяем, что элемент существует
if (!container) {
  throw new Error('Не найден элемент с id "root"');
}

// Создаем корень React
const root = createRoot(container);

// Рендерим приложение
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
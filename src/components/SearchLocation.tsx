import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  TextField, 
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress
} from '@mui/material';

interface SearchLocationProps {
  onLocationSelect: (location: [number, number], zoom?: number) => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  importance: number;
}

const SearchLocation: React.FC<SearchLocationProps> = ({ onLocationSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Функция для проверки, является ли строка координатами
  const parseCoordinates = (query: string): [number, number] | null => {
    // Улучшенная проверка координат - поддерживает больше форматов
    const coordPattern = /^\s*(-?\d+(\.\d+)?)\s*[,;]\s*(-?\d+(\.\d+)?)\s*$/;
    const coordMatch = query.match(coordPattern);
    
    if (coordMatch) {
      // Извлекаем координаты из совпадения
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      
      // Проверка валидности координат
      if (!isNaN(lat) && !isNaN(lon) && 
          lat >= -90 && lat <= 90 && 
          lon >= -180 && lon <= 180) {
        return [lon, lat];
      }
    }
    return null;
  };

  // Функция для поиска по названию места
  const searchLocation = useCallback(async (query: string) => {
    // Проверяем сначала, не координаты ли это
    const coordinates = parseCoordinates(query);
    if (coordinates) {
      // Если это координаты - сразу обновляем карту без поиска
      onLocationSelect(coordinates, 14);
      setResults([]);
      setShowResults(false);
      setLoading(false);
      return;
    }
    
    // Если не пустой запрос и не координаты, делаем поиск
    if (query.trim()) {
      setLoading(true);
      
      try {
        // Делаем запрос геокодирования
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          {
            headers: {
              'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            },
          }
        );
        
        if (response.ok) {
          const data: SearchResult[] = await response.json();
          setResults(data);
          setShowResults(data.length > 0);
        } else {
          console.error('Ошибка при поиске:', response.statusText);
          setResults([]);
          setShowResults(false);
        }
      } catch (error) {
        console.error('Ошибка при поиске:', error);
        setResults([]);
        setShowResults(false);
      } finally {
        setLoading(false);
      }
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [onLocationSelect]);
  
  // Проверка ввода на каждое изменение текста
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Сразу проверяем на координаты
    const coordinates = parseCoordinates(value);
    if (coordinates) {
      // Если это координаты - немедленно обновляем карту
      onLocationSelect(coordinates, 14);
      setResults([]);
      setShowResults(false);
      return;
    }
  };
  
  // Debounce только для поиска по названиям мест
  useEffect(() => {
    // Если уже распознали как координаты - ничего не делаем
    if (parseCoordinates(searchQuery)) return;
    
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchLocation(searchQuery);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300); // Задержка только для поиска по названиям
    
    return () => clearTimeout(timer);
  }, [searchQuery, searchLocation]);
  
  // Выбор результата из списка
  const handleSelectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    // Определяем масштаб карты на основе важности результата
    const zoomLevel = Math.max(7, Math.min(17, 18 - Math.floor(result.importance * 10)));
    
    onLocationSelect([lon, lat], zoomLevel);
    setSearchQuery(result.display_name.split(',')[0]); // Устанавливаем первую часть названия в поле ввода
    setResults([]);
    setShowResults(false);
  };

  return (
    <Box sx={{ position: 'relative', width: 300 }}>
      <TextField
        size="small"
        placeholder="Отправляемся в..."
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={() => results.length > 0 && setShowResults(true)}
        sx={{
          backgroundColor: (theme) => theme.palette.background.paper,
          borderRadius: 1,
          width: '100%',
        }}
        InputProps={{
          endAdornment: loading ? <CircularProgress size={20} color="inherit" /> : null
        }}
      />
      
      {/* Выпадающий список с результатами - только если не координаты */}
      {showResults && results.length > 0 && !parseCoordinates(searchQuery) && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 0.5,
            maxHeight: 300,
            overflow: 'auto',
            zIndex: 1300,
          }}
        >
          <List dense>
            {results.map((result, index) => (
              <ListItemButton
                key={index}
                onClick={() => handleSelectResult(result)}
                divider={index < results.length - 1}
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemText
                  primary={result.display_name.split(',')[0]}
                  secondary={
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {result.display_name.split(',').slice(1).join(',')}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default SearchLocation;
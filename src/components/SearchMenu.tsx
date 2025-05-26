import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Divider,
  useTheme,
  Button
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import WaterIcon from '@mui/icons-material/Water';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';

export type SearchType = 'trenches' | 'fortifications' | 'buildings' | 'reservoirs' | 'impact_analysis';

interface SearchOption {
  id: SearchType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface SearchMenuProps {
  open: boolean;
  onClose: () => void;
  onSearchSelect: (searchId: SearchType) => void;
  selectedSearches: SearchType[];
  onStartAnalysis?: () => void;
}

const searchOptions: SearchOption[] = [
  { 
    id: 'trenches', 
    name: 'Поиск окопов', 
    icon: <SearchIcon />, 
    description: 'Поиск и анализ окопов на местности'
  },
  { 
    id: 'fortifications', 
    name: 'Поиск укрепов', 
    icon: <SecurityIcon />, 
    description: 'Поиск укрепленных позиций и фортификаций'
  },
  { 
    id: 'buildings', 
    name: 'Поиск построек', 
    icon: <HomeWorkIcon />, 
    description: 'Поиск зданий и строительных объектов'
  },
  { 
    id: 'reservoirs', 
    name: 'Проверка резервуаров', 
    icon: <WaterIcon />, 
    description: 'Анализ резервуаров и водных объектов'
  },
  { 
    id: 'impact_analysis', 
    name: 'Анализ места прилета', 
    icon: <GpsFixedIcon />, 
    description: 'Анализ зон воздействия и повреждений'
  }
];

const SearchMenu: React.FC<SearchMenuProps> = ({ 
  open, 
  onClose, 
  onSearchSelect, 
  selectedSearches,
  onStartAnalysis
}) => {
  const theme = useTheme();
  
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      variant="temporary"
      sx={{
        width: 300,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 300,
          boxSizing: 'border-box',
          marginTop: '64px',
          height: 'calc(100% - 64px)',
          marginLeft: '68px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Заголовок - фиксированный */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        p: 1,
        flexShrink: 0 
      }}>
        <Typography variant="h6" sx={{ p: 1 }}>
          Поиск и анализ
        </Typography>
        <IconButton onClick={onClose}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ flexShrink: 0 }} />
      
      {/* Прокручиваемый список опций */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <List sx={{ 
          p: 1, 
          overflow: 'auto',
          flex: 1,
          // Стилизация полосы прокрутки
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.05)' 
              : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.2)' 
              : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '3px',
            '&:hover': {
              background: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.3)' 
                : 'rgba(0, 0, 0, 0.3)',
            },
          },
          // Для Firefox
          scrollbarWidth: 'thin',
          scrollbarColor: theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05)' 
            : 'rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05)',
        }}>
          {searchOptions.map((option) => (
            <ListItemButton
              key={option.id}
              onClick={() => {
                onSearchSelect(option.id);
              }}
              selected={selectedSearches.includes(option.id)}
              sx={{
                mb: 0.5,
                borderRadius: 1,
                bgcolor: selectedSearches.includes(option.id) 
                  ? theme.palette.primary.main + '20' 
                  : 'transparent',
                border: selectedSearches.includes(option.id) 
                  ? `1px solid ${theme.palette.primary.main}` 
                  : '1px solid transparent',
                '&:hover': {
                  bgcolor: selectedSearches.includes(option.id) 
                    ? theme.palette.primary.main + '30' 
                    : theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: selectedSearches.includes(option.id) 
                    ? theme.palette.primary.main 
                    : theme.palette.text.secondary,
                }}
              >
                {option.icon}
              </ListItemIcon>
              <ListItemText 
                primary={option.name} 
                secondary={option.description}
                primaryTypographyProps={{ 
                  fontWeight: selectedSearches.includes(option.id) ? 'bold' : 'normal',
                  color: selectedSearches.includes(option.id) 
                    ? theme.palette.primary.main 
                    : theme.palette.text.primary,
                }}
              />
            </ListItemButton>          ))}
        </List>
      </Box>
      
      {/* Кнопка запуска анализа - фиксированная внизу */}
      <Box sx={{ 
        flexShrink: 0,
        p: 2,
        borderTop: `1px solid ${theme.palette.divider}`
      }}>
        <Button
          variant="contained"
          fullWidth
          size="large"
          disabled={selectedSearches.length === 0}
          onClick={onStartAnalysis}
          startIcon={<PlayArrowIcon />}
          sx={{
            py: 1.5,
            fontWeight: 'bold',
            fontSize: '1rem',
            borderRadius: 2,
            '&:disabled': {
              opacity: 0.5,
            },
          }}
        >
          Запустить анализ
        </Button>
        {selectedSearches.length === 0 && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              display: 'block', 
              textAlign: 'center', 
              mt: 1 
            }}
          >
            Выберите тип поиска для анализа
          </Typography>
        )}
        {selectedSearches.length > 0 && (
          <Typography 
            variant="caption" 
            color="primary" 
            sx={{ 
              display: 'block', 
              textAlign: 'center', 
              mt: 1,
              fontWeight: 'medium'
            }}
          >
            Выбрано типов поиска: {selectedSearches.length}
          </Typography>
        )}
      </Box>
    </Drawer>
  );
};

export default SearchMenu;
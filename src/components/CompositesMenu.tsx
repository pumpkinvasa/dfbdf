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
  useTheme
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CompareIcon from '@mui/icons-material/Compare';
import DifferenceIcon from '@mui/icons-material/Difference';

export type CompositeType = 
  | 'trenches'
  | 'sarDiff';

interface Composite {
  id: CompositeType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface CompositesMenuProps {
  open: boolean;
  onClose: () => void;
  onCompositeSelect: (compositeId: CompositeType) => void;
  currentComposite: CompositeType | null;
}

const compositeOptions: Composite[] = [
  { 
    id: 'trenches', 
    name: 'Долгие окопы', 
    icon: <CompareIcon />, 
    description: 'Анализ долгих окопов на местности'
  },
  { 
    id: 'sarDiff', 
    name: 'Отличия (SAR)', 
    icon: <DifferenceIcon />, 
    description: 'Анализ отличий с помощью SAR-снимков'
  }
];

const CompositesMenu: React.FC<CompositesMenuProps> = ({ 
  open, 
  onClose, 
  onCompositeSelect, 
  currentComposite
}) => {
  const theme = useTheme();
  
  return (    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      variant="temporary"
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      sx={{
        width: 300,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 300,
          boxSizing: 'border-box',
          marginTop: '64px', // Отступ сверху под AppBar
          height: 'calc(100% - 64px)', // Высота с учетом верхней панели
          marginLeft: '68px', // Отступ слева для левого сайдбара
          overflow: 'hidden', // Убираем общую прокрутку
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
          Композиты
        </Typography>
        <IconButton onClick={onClose}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ flexShrink: 0 }} />
      
      {/* Прокручиваемый список композитов */}
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
          {compositeOptions.map((composite) => (
            <ListItemButton
              key={composite.id}
              onClick={() => {
                onCompositeSelect(composite.id);
              }}
              selected={currentComposite === composite.id}
              sx={{
                mb: 0.5,
                borderRadius: 1,
              }}
            >
              <ListItemIcon>
                {composite.icon}
              </ListItemIcon>
              <ListItemText 
                primary={composite.name} 
                secondary={composite.description}
                primaryTypographyProps={{ 
                  fontWeight: currentComposite === composite.id ? 'bold' : 'normal' 
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

export default CompositesMenu;

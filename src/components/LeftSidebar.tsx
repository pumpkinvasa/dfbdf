import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  Divider,
  useTheme,
  Tooltip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LayersIcon from '@mui/icons-material/Layers';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';

interface TabContent {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface LeftSidebarProps {
  onLayersClick?: () => void;
  onCompositesClick?: () => void;
  layersMenuOpen?: boolean;
  compositesMenuOpen?: boolean;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
  onLayersClick, 
  onCompositesClick,
  layersMenuOpen,
  compositesMenuOpen 
}) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const theme = useTheme();

  // Сбрасываем выделение кнопки при закрытии соответствующего меню
  useEffect(() => {
    if (!layersMenuOpen && selectedTab === 1) {
      setSelectedTab(0);
    }
    if (!compositesMenuOpen && selectedTab === 2) {
      setSelectedTab(0);
    }
  }, [layersMenuOpen, compositesMenuOpen, selectedTab]);

  const tabs: TabContent[] = [
    {
      title: 'Панель управления',
      icon: <DashboardIcon />,
      content: (
        <Box p={3}>
          <h5>Панель управления</h5>
          <p>Здесь вы можете управлять основными функциями и просматривать статистику.</p>
        </Box>
      ),
    },
    {
      title: 'Слои карты',
      icon: <LayersIcon />,
      content: (
        <Box p={3}>
          <h5>Слои карты</h5>
          <p>Здесь вы можете выбрать различные слои для отображения на карте.</p>
        </Box>
      ),
    },    {
      title: 'Композитные слои',
      icon: <FormatColorFillIcon />,
      content: (
        <Box p={3}>
          <h5>Композитные слои</h5>
          <p>Анализ изменений и композитные слои.</p>
        </Box>
      ),
    },
    {
      title: 'Уведомления',
      icon: <NotificationsIcon />,
      content: (
        <Box p={3}>
          <h5>Уведомления</h5>
          <p>Здесь можно увидеть все ваши уведомления и обновления системы.</p>
        </Box>
      ),
    },
    {
      title: 'Настройки',
      icon: <SettingsIcon />,
      content: (
        <Box p={3}>
          <h5>Настройки</h5>
          <p>Здесь вы можете настроить параметры приложения под свои предпочтения.</p>
        </Box>
      ),
    },
  ];

  // Фиксированная ширина для компактного режима (только иконки)
  const drawerWidth = 68;

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Левый сайдбар - всегда в компактном режиме */}
      <Drawer
        variant="permanent"
        anchor="left"
        open={true}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            marginTop: '64px', // Отступ сверху, если есть верхняя панель
            height: 'calc(100% - 64px)', // Высота с учетом верхней панели
            border: 'none',
            boxShadow: theme.palette.mode === 'light' 
              ? '0px 4px 20px rgba(0, 0, 0, 0.05)' 
              : '0px 4px 20px rgba(0, 0, 0, 0.3)',
            overflowX: 'hidden',
          },
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            height: '100%',
            overflowX: 'hidden',
          }}
        >
          <Divider sx={{ mb: 1 }} />
          {/* Вертикальное меню с вкладками - только иконки */}
          <List sx={{ width: '100%', p: 0 }}>
            {tabs.map((tab, index) => (
              <Tooltip key={index} title={tab.title} placement="right">
                <ListItemButton
                  selected={selectedTab === index}
                  onClick={() => {
                    setSelectedTab(index);
                    // Если это кнопка слоев (индекс 1), вызываем onLayersClick
                    if (index === 1 && onLayersClick) {
                      onLayersClick();
                    }
                    // Если это кнопка композитов (индекс 2), вызываем onCompositesClick
                    if (index === 2 && onCompositesClick) {
                      onCompositesClick();
                    }
                  }}
                  sx={{
                    py: 1.5,
                    justifyContent: 'center',
                    minHeight: 48,
                    mb: 0.5,
                    borderRadius: '0 8px 8px 0',
                    mx: 0.5,
                    bgcolor: selectedTab === index 
                      ? theme.palette.primary.light
                      : 'transparent',
                    '&:hover': {
                      bgcolor: selectedTab === index 
                        ? theme.palette.primary.light
                        : theme.palette.action.hover,
                    }
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      minWidth: 0,
                      color: selectedTab === index 
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                      fontSize: 24
                    }}
                  >
                    {tab.icon}
                  </ListItemIcon>
                </ListItemButton>
              </Tooltip>
            ))}
          </List>

          <Divider sx={{ my: 2 }} />
        </Box>
      </Drawer>
    </Box>
  );
};

export default LeftSidebar;
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
  FormGroup,
  FormControlLabel,
  Checkbox,
  useTheme
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MapIcon from '@mui/icons-material/Map';
import SatelliteIcon from '@mui/icons-material/Satellite';

export type LayerType = 
  | 'OSM' 
  | 'BingAerial' 
  | 'YandexSatellite'
  | 'GoogleSatellite'
  | 'ESRISatellite'
  | 'ESRIStreet';

interface Layer {
  id: LayerType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface LayersMenuProps {
  open: boolean;
  onClose: () => void;
  onLayerSelect: (layerId: LayerType) => void;
  currentLayer: LayerType;
}

const layerOptions: Layer[] = [
  { 
    id: 'OSM', 
    name: 'OpenStreetMap', 
    icon: <MapIcon />, 
    description: 'Стандартная карта OSM с улицами и зданиями'
  },
  { 
    id: 'BingAerial', 
    name: 'Bing (спутник)', 
    icon: <SatelliteIcon />, 
    description: 'Спутниковые снимки от Bing Maps'
  },
  { 
    id: 'YandexSatellite', 
    name: 'Яндекс (спутник)', 
    icon: <SatelliteIcon />, 
    description: 'Спутниковые снимки от Яндекс.Карт'
  },
  { 
    id: 'GoogleSatellite', 
    name: 'Google (спутник)', 
    icon: <SatelliteIcon />, 
    description: 'Спутниковые снимки от Google Maps'
  },
  { 
    id: 'ESRISatellite', 
    name: 'ESRI (спутник)', 
    icon: <SatelliteIcon />, 
    description: 'Спутниковые снимки от ESRI World Imagery'
  },
  { 
    id: 'ESRIStreet', 
    name: 'ESRI (улицы)', 
    icon: <MapIcon />, 
    description: 'Уличная карта от ESRI World Street Map'
  }
];

const LayersMenu: React.FC<LayersMenuProps> = ({ 
  open, 
  onClose, 
  onLayerSelect, 
  currentLayer
}) => {
  const theme = useTheme();return (
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
          Слои карты
        </Typography>
        <IconButton onClick={onClose}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ flexShrink: 0 }} />
      
      {/* Прокручиваемый список слоев */}
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
        }}>          {layerOptions.map((layer) => (
            <ListItemButton
              key={layer.id}
              onClick={() => {
                onLayerSelect(layer.id);
              }}
              selected={currentLayer === layer.id}
              sx={{
                mb: 0.5,
                borderRadius: 1,
              }}
            >
              <ListItemIcon>
                {layer.icon}
              </ListItemIcon>
              <ListItemText 
                primary={layer.name} 
                secondary={layer.description}
                primaryTypographyProps={{ fontWeight: currentLayer === layer.id ? 'bold' : 'normal' }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>      <Divider sx={{ flexShrink: 0, my: 1 }} />

      {/* Дополнительные слои - фиксированные */}
      <Box sx={{ px: 2, pb: 2, flexShrink: 0 }}>        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={false}
                size="small"
              />
            }
            label="Границы"
            sx={{ mb: 0.5 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={false}
                size="small"
              />
            }
            label="Контуры"
            sx={{ mb: 0.5 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={true}
                size="small"
              />
            }
            label="Подписи"
            sx={{ mb: 0.5 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={false}
                size="small"
              />
            }
            label="Дороги"
          />
        </FormGroup>
      </Box>
    </Drawer>
  );
};

export default LayersMenu;
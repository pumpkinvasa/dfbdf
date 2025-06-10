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
import GeoJSON from 'ol/format/GeoJSON';
import { getArea } from 'ol/sphere';
import Polygon from 'ol/geom/Polygon';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

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
  aoiPolygons?: any[];
  onPolygonSelect?: (polygonIndex: number) => void;
  onPolygonToggleVisibility?: (polygonIndex: number) => void;
  onPolygonDelete?: (polygonIndex: number) => void;
  polygonVisibility?: boolean[];
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
  currentLayer,
  aoiPolygons = [],
  onPolygonSelect,
  onPolygonToggleVisibility,
  onPolygonDelete,
  polygonVisibility = []
}) => {
  const theme = useTheme();

  // Отладочное логирование
  console.log('LayersMenu: полигоны AOI:', aoiPolygons);

  return (<Drawer
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
      }}>        <Typography variant="h6" sx={{ p: 1 }}>
          Слои
        </Typography>
        <IconButton onClick={onClose}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ flexShrink: 0 }} />
        {/* Прокручиваемое содержимое */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
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
      }}>        {/* Раздел Зона AOI */}
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle1" sx={{ px: 1, py: 0.5, fontWeight: 'bold' }}>
            Зона AOI
          </Typography>
          <List dense>
            {aoiPolygons.length === 0 ? (
              <Box sx={{ px: 1, py: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Нет зон AOI. Нарисуйте полигоны на карте.
                </Typography>
              </Box>
            ) : (              aoiPolygons.map((polygon, index) => {
                // Рассчитываем площадь полигона правильно
                let areaText = 'Область исследования';
                
                try {
                  // Создаем геометрию из GeoJSON данных
                  const format = new GeoJSON();
                  const feature = format.readFeature(polygon, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857',
                  });
                    // Проверяем, что feature это не массив
                  if (Array.isArray(feature)) {
                    console.warn('Получен массив фичей, ожидалась одна фича');
                    areaText = 'Ошибка данных';
                  } else {
                    const geometry = feature.getGeometry();
                    if (geometry && geometry instanceof Polygon) {
                      // Используем точный расчет площади из OpenLayers
                      const areaM2 = getArea(geometry, { projection: 'EPSG:3857' });
                      const areaKm2 = (areaM2 / 1_000_000).toFixed(2); // Конвертируем в км²
                      areaText = `${areaKm2} км²`;
                    }
                  }
                } catch (error) {
                  console.error('Ошибка при расчете площади полигона:', error);
                  areaText = 'Ошибка расчета';
                }

                const isVisible = polygonVisibility[index] !== false;

                // Цвет иконок как в райт сайдбаре
                const iconColor = theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main;

                return (
                  <ListItemButton
                    key={index}
                    onClick={() => onPolygonSelect?.(index)}
                    sx={{
                      mb: 0.5,
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: theme.palette.action.hover,
                      },
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ListItemIcon>
                      <SatelliteIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`Полигон AOI ${index + 1}`}
                      secondary={areaText}
                    />
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        onPolygonToggleVisibility?.(index);
                      }}
                      sx={{ ml: 1, color: iconColor }}
                    >
                      {isVisible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        onPolygonDelete?.(index);
                      }}
                      sx={{ ml: 0.5, color: iconColor }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemButton>
                );
              })
            )}
          </List>
        </Box>

        <Divider sx={{ mx: 2 }} />

        {/* Раздел Подложка */}
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle1" sx={{ px: 1, py: 0.5, fontWeight: 'bold' }}>
            Подложка
          </Typography>
          <List dense>
            {layerOptions.map((layer) => (
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
        </Box>

        <Divider sx={{ mx: 2 }} />

        {/* Дополнительные опции */}
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="subtitle1" sx={{ px: 1, py: 0.5, fontWeight: 'bold' }}>
            Дополнительные слои
          </Typography>
          <FormGroup>
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
      </Box>
    </Drawer>
  );
};

export default LayersMenu;
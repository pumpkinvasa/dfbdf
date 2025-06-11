import React, { useState } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Divider,
  useTheme,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SatelliteIcon from '@mui/icons-material/Satellite';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PublicIcon from '@mui/icons-material/Public';
import { GeoJSON } from 'ol/format';
import { getArea } from 'ol/sphere';
import Polygon from 'ol/geom/Polygon';
import QuickPolygonSelector from './QuickPolygonSelector';

interface DashboardMenuProps {
  open: boolean;
  onClose: () => void;
  aoiPolygons?: any[];
  onPolygonSelect?: (polygonIndex: number) => void;
  onPolygonToggleVisibility?: (polygonIndex: number) => void;
  onPolygonDelete?: (polygonIndex: number) => void;
  polygonVisibility?: boolean[];
  onPolygonHover?: (polygonIndex: number | null) => void;
  hoveredPolygonIndex?: number | null;
  onPolygonZoom?: (polygonIndex: number) => void;
  onTerritoryPolygonAdd?: (geoJSON: any) => void;
}

const DashboardMenu: React.FC<DashboardMenuProps> = ({ 
  open, 
  onClose, 
  aoiPolygons = [],
  onPolygonSelect,
  onPolygonToggleVisibility,
  onPolygonDelete,
  polygonVisibility = [],
  onPolygonHover,
  hoveredPolygonIndex,
  onPolygonZoom,
  onTerritoryPolygonAdd
}) => {
  const theme = useTheme();
  const [quickPolygonSelectorOpen, setQuickPolygonSelectorOpen] = useState(false);
  const handlePolygonDoubleClick = (index: number) => {
    // Только при двойном клике приближаемся к полигону
    onPolygonZoom?.(index);
  };
  const handleDownloadPolygon = (polygon: any, index: number) => {
    try {
      // Создаем GeoJSON объект с одним полигоном
      const geoJsonData = {
        type: 'FeatureCollection',
        features: [polygon]
      };

      // Конвертируем в JSON строку
      const dataStr = JSON.stringify(geoJsonData, null, 2);
      
      // Создаем Blob
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Создаем ссылку для скачивания
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `polygon_aoi_${index + 1}.geojson`;
      
      // Запускаем скачивание
      document.body.appendChild(link);
      link.click();
      
      // Очищаем ресурсы
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`Полигон AOI ${index + 1} скачан как GeoJSON`);
    } catch (error) {
      console.error('Ошибка при скачивании полигона:', error);
    }
  };

  const handleTerritorySelect = (territory: any) => {
    if (!territory.coordinates || !onTerritoryPolygonAdd) return;

    try {
      // Создаем GeoJSON объект из координат территории
      const geoJSON = {
        type: 'Feature',
        properties: {
          name: territory.name,
          type: territory.type,
          parent: territory.parent,
          source: 'quick_polygon'
        },
        geometry: {
          type: 'Polygon',
          coordinates: territory.coordinates
        }
      };

      console.log('Создан полигон территории:', territory.name, geoJSON);
      onTerritoryPolygonAdd(geoJSON);
    } catch (error) {
      console.error('Ошибка при создании полигона территории:', error);
    }
  };
  return (
    <>
    <Drawer
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
      }}>        <Typography variant="h6" sx={{ p: 1 }}>
          Управление AOI
        </Typography>
        <IconButton onClick={onClose}>
          <ChevronRightIcon />
        </IconButton>      </Box>
      <Divider sx={{ flexShrink: 0 }} />

      {/* Кнопка быстрого полигона */}
      <Box sx={{ p: 1, flexShrink: 0 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PublicIcon />}
          onClick={() => setQuickPolygonSelectorOpen(true)}
          sx={{
            borderColor: theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main,
            color: theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main,
            '&:hover': {
              borderColor: theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main,
              backgroundColor: theme.palette.mode === 'dark' 
                ? 'rgba(0, 229, 197, 0.08)' 
                : 'rgba(25, 118, 210, 0.08)',
            },
          }}
        >
          Быстрый полигон
        </Button>
      </Box>
      <Divider sx={{ flexShrink: 0 }} />{/* Прокручиваемый контент */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
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
        scrollbarWidth: 'thin',
        scrollbarColor: theme.palette.mode === 'dark' 
          ? 'rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05)' 
          : 'rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05)',
      }}>
        <Box sx={{ p: 1 }}>
          <List dense>
            {aoiPolygons.length === 0 ? (
              <Box sx={{ px: 1, py: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Нет зон AOI. Нарисуйте полигоны на карте.
                </Typography>
              </Box>
            ) : (
              aoiPolygons.map((polygon, index) => {
                let areaText = 'Область исследования';
                
                try {
                  const format = new GeoJSON();
                  const feature = format.readFeature(polygon, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857',
                  });
                  
                  if (Array.isArray(feature)) {
                    console.warn('Получен массив фичей, ожидалась одна фича');
                    areaText = 'Ошибка данных';
                  } else {
                    const geometry = feature.getGeometry();
                    if (geometry && geometry instanceof Polygon) {
                      const areaM2 = getArea(geometry, { projection: 'EPSG:3857' });
                      const areaKm2 = (areaM2 / 1_000_000).toFixed(2);
                      areaText = `${areaKm2} км²`;
                    }
                  }
                } catch (error) {
                  console.error('Ошибка при расчете площади полигона:', error);
                  areaText = 'Ошибка расчета';
                }

                const isVisible = polygonVisibility[index] !== false;
                const iconColor = theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main;

                return (                  <ListItemButton
                    key={index}
                    onDoubleClick={() => handlePolygonDoubleClick(index)}
                    onMouseEnter={() => onPolygonHover?.(index)}
                    onMouseLeave={() => onPolygonHover?.(null)}
                    sx={{
                      mb: 0.5,
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: theme.palette.action.hover,
                      },
                      display: 'flex',
                      alignItems: 'center',
                      ...(hoveredPolygonIndex === index && {
                        boxShadow: `0 0 0 2px ${theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main}`,
                      }),
                    }}
                  >
                    <ListItemIcon>
                      <SatelliteIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`Полигон AOI ${index + 1}`}
                      secondary={areaText}
                    />                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        handleDownloadPolygon(polygon, index);
                      }}
                      sx={{ ml: 1, color: iconColor }}
                      title="Скачать GeoJSON"
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        onPolygonToggleVisibility?.(index);
                      }}
                      sx={{ ml: 0.5, color: iconColor }}
                      title="Переключить видимость"
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
                      title="Удалить полигон"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemButton>
                );
              })
            )}
          </List>        </Box>
      </Box>
    </Drawer>

    {/* Диалог быстрого выбора полигона */}
    <QuickPolygonSelector
      open={quickPolygonSelectorOpen}
      onClose={() => setQuickPolygonSelectorOpen(false)}
      onTerritorySelect={handleTerritorySelect}
    />
  </>);
};

export default DashboardMenu;
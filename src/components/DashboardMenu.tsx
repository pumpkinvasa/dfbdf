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
  Button,
  Collapse
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SatelliteIcon from '@mui/icons-material/Satellite';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PublicIcon from '@mui/icons-material/Public';
import MapIcon from '@mui/icons-material/Map';
import { GeoJSON } from 'ol/format';
import { getArea } from 'ol/sphere';
import { toLonLat } from 'ol/proj';
import Polygon from 'ol/geom/Polygon';
import MultiPolygon from 'ol/geom/MultiPolygon';
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
  onPolygonPartZoom?: (polygonIndex: number, partIndex: number) => void; // Новый пропс для зума к части
  onPolygonPartToggleVisibility?: (polygonIndex: number, partIndex: number) => void; // Переключение видимости части
  onPolygonPartHover?: (polygonIndex: number, partIndex: number | null) => void; // Подсветка части
  onPolygonPartDelete?: (polygonIndex: number, partIndex: number) => void; // Удаление части
  polygonPartVisibility?: Map<number, Map<number, boolean>>; // Состояние видимости частей
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
  onTerritoryPolygonAdd,
  onPolygonPartZoom,
  onPolygonPartToggleVisibility,
  onPolygonPartHover,
  onPolygonPartDelete,
  polygonPartVisibility
}) => {const theme = useTheme();  const [quickPolygonSelectorOpen, setQuickPolygonSelectorOpen] = useState(false);
  const [expandedPolygons, setExpandedPolygons] = useState<Set<number>>(new Set());
  const [hoveredPart, setHoveredPart] = useState<{polygonIndex: number, partIndex: number} | null>(null);
  
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
  };  const handleTerritorySelect = (territory: any) => {
    if (!territory.coordinates || !onTerritoryPolygonAdd) return;

    try {
      // Создаем GeoJSON объект из координат территории
      let geometry;
      
      if (territory.coordinates.length === 1) {
        // Одна часть территории - обычный полигон
        geometry = {
          type: 'Polygon',
          coordinates: territory.coordinates
        };
      } else {
        // Несколько частей территории - мультиполигон
        geometry = {
          type: 'MultiPolygon',
          coordinates: territory.coordinates.map((polygon: number[][]) => [polygon])
        };
      }

      const geoJSON = {
        type: 'Feature',
        properties: {
          name: territory.name,
          type: territory.type,
          parent: territory.parent,
          source: 'quick_polygon',
          parts: territory.coordinates.length // Добавляем информацию о количестве частей
        },
        geometry
      };

      console.log('Создан полигон территории:', territory.name, 
                  `(${territory.coordinates.length} ${territory.coordinates.length === 1 ? 'часть' : 'частей'})`, 
                  geoJSON);
      onTerritoryPolygonAdd(geoJSON);
    } catch (error) {
      console.error('Ошибка при создании полигона территории:', error);
    }
  };  const togglePolygonExpanded = (index: number) => {
    setExpandedPolygons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };  // Функция для определения, нужно ли разбивать мультиполигон на части
  const shouldShowPolygonParts = (polygon: any, geometry: MultiPolygon): boolean => {
    // Получаем количество частей
    const partsCount = geometry.getPolygons().length;
    
    // Если только одна часть, то не разбиваем
    if (partsCount <= 1) return false;
    
    // Проверяем тип территории по свойствам
    const polygonType = polygon.properties?.type?.toLowerCase();
    const polygonName = polygon.properties?.name?.toLowerCase() || '';
    const polygonParent = polygon.properties?.parent?.toLowerCase() || '';
    
    // Не разбиваем административные единицы на части (регионы, области, края и т.д.)
    // Это относится к территориям, которые являются частями стран
    if (polygonType === 'state' || polygonType === 'region' || polygonType === 'province') {
      return false; // Регионы/области/края не разбиваем на части
    }
    
    // Дополнительная проверка по названиям для всех административных единиц
    const administrativeKeywords = [
      'область', 'край', 'республика', 'округ', 'region', 'state', 'province',
      'prefecture', 'county', 'district', 'федеральный округ', 'автономный округ',
      'губерния', 'воеводство', 'земля', 'кантон', 'штат', 'департамент'
    ];
    
    const isAdministrativeUnit = administrativeKeywords.some(keyword => 
      polygonName.includes(keyword) || polygonParent.includes(keyword)
    );
    
    if (isAdministrativeUnit) {
      return false; // Не показываем части для административных единиц
    }
    
    // Проверяем, является ли это страной с административными единицами
    // Страны с большим количеством частей обычно содержат административные единицы
    if (polygonType === 'country' || polygonName.includes('страна') || polygonParent === '') {
      // Если у страны слишком много частей (больше 10), это скорее всего административные единицы
      if (partsCount > 10) {
        return false; // Не разбиваем страны с множеством административных единиц
      }
      
      // Для стран с небольшим количеством частей проверяем, действительно ли части географически разделены
      const polygons = geometry.getPolygons();
      
      if (polygons.length === 2) {
        // Вычисляем центры масс для двух частей
        const centers = polygons.map(poly => {
          const extent = poly.getExtent();
          return [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
        });
        
        // Преобразуем в географические координаты
        const [center1, center2] = centers.map(center => toLonLat(center));
        
        // Вычисляем расстояние между центрами
        const distance = Math.sqrt(
          Math.pow(center1[0] - center2[0], 2) + Math.pow(center1[1] - center2[1], 2)
        );
        
        // Если расстояние больше 5 градусов, считаем это географически разделенными территориями
        // (например, Россия и Калининградская область, США и Аляска)
        return distance > 5;
      }
      
      // Для случаев с 3-10 частями проверяем более строго
      if (polygons.length >= 3 && polygons.length <= 10) {
        // Проверяем, есть ли действительно удаленные части
        const centers = polygons.map(poly => {
          const extent = poly.getExtent();
          return toLonLat([(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]);
        });
        
        // Находим максимальное расстояние между частями
        let maxDistance = 0;
        for (let i = 0; i < centers.length; i++) {
          for (let j = i + 1; j < centers.length; j++) {
            const distance = Math.sqrt(
              Math.pow(centers[i][0] - centers[j][0], 2) + 
              Math.pow(centers[i][1] - centers[j][1], 2)
            );
            maxDistance = Math.max(maxDistance, distance);
          }
        }
        
        // Показываем части только если есть действительно удаленные территории
        return maxDistance > 8;
      }
    }
    
    // По умолчанию не показываем части
    return false;
  };

  // Функция для получения видимости части из пропсов
  const getPartVisibility = (polygonIndex: number, partIndex: number): boolean => {
    const polygonParts = polygonPartVisibility?.get(polygonIndex);
    if (!polygonParts) return true; // По умолчанию части видимы
    return polygonParts.get(partIndex) ?? true;
  };
  // Функция для скачивания части полигона
  const handleDownloadPolygonPart = (polygonIndex: number, partIndex: number, partName: string) => {
    try {
      const polygon = aoiPolygons[polygonIndex];
      if (!polygon) return;

      const format = new GeoJSON();
      const featureOrFeatures = format.readFeature(polygon, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });
      
      // Убеждаемся, что это одна фича, а не массив
      const feature = Array.isArray(featureOrFeatures) ? featureOrFeatures[0] : featureOrFeatures;
      
      const geometry = feature.getGeometry();
      if (geometry instanceof MultiPolygon) {
        const polygons = geometry.getPolygons();
        if (partIndex < polygons.length) {
          const partPolygon = polygons[partIndex];
          
          // Получаем координаты части как Polygon
          const partGeometry = format.writeGeometryObject(partPolygon, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });
          
          // Создаем новый GeoJSON для части
          const partGeoJSON = {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: {
                ...polygon.properties,
                name: partName,
                originalPolygonIndex: polygonIndex,
                partIndex: partIndex
              },
              geometry: partGeometry
            }]
          };

          // Скачиваем файл
          const dataStr = JSON.stringify(partGeoJSON, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `polygon_part_${polygonIndex + 1}_${partIndex + 1}_${partName.replace(/\s/g, '_')}.geojson`;
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log(`Часть полигона ${partName} скачана как GeoJSON`);
        }
      }
    } catch (error) {
      console.error('Ошибка при скачивании части полигона:', error);
    }
  };  // Функция для переключения видимости части
  const handleTogglePartVisibility = (polygonIndex: number, partIndex: number) => {
    // Интеграция с картой через callback (state management перенесён в родительский компонент)
    onPolygonPartToggleVisibility?.(polygonIndex, partIndex);
  };
  // Функция для удаления части полигона
  const handleDeletePolygonPart = (polygonIndex: number, partIndex: number) => {
    // Вызываем callback для удаления части из карты
    onPolygonPartDelete?.(polygonIndex, partIndex);
  };

  const renderPolygonParts = (geometry: MultiPolygon, polygonIndex: number, polygonName: string) => {
    const polygons = geometry.getPolygons();
    const iconColor = theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main;
    
    // Сортируем полигоны по площади (самый большой первый)
    const sortedPolygons = polygons
      .map((polygon, idx) => ({ polygon, originalIndex: idx }))
      .sort((a, b) => {
        const areaA = getArea(a.polygon, { projection: 'EPSG:3857' });
        const areaB = getArea(b.polygon, { projection: 'EPSG:3857' });
        return areaB - areaA; // По убыванию площади
      });

    return sortedPolygons.map(({ polygon, originalIndex }, sortedIndex) => {
      const areaM2 = getArea(polygon, { projection: 'EPSG:3857' });
      const areaKm2 = (areaM2 / 1_000_000).toFixed(2);
        // Определяем название части
      let partName = '';
      if (sortedIndex === 0) {
        partName = 'Основная территория';
      } else {
        // Пытаемся определить географически разделенные регионы по координатам
        const extent = polygon.getExtent();
        const centerLon = (extent[0] + extent[2]) / 2;
        const centerLat = (extent[1] + extent[3]) / 2;
        
        // Преобразуем координаты в WGS84 для анализа
        const [lon, lat] = toLonLat([centerLon, centerLat]);
        
        // Специальная логика для известных географически разделенных территорий
        if (polygonName.toLowerCase().includes('россия') || polygonName.toLowerCase().includes('russia')) {
          // Для России определяем географически отделенные территории
          if (lon >= 19 && lon <= 23 && lat >= 54 && lat <= 56) {
            partName = 'Калининградская область';
          } else if (lon >= 180 || lon <= -170) {
            partName = 'Чукотский АО (восток)';
          } else {
            partName = `Отдельная территория ${sortedIndex}`;
          }
        } else if (polygonName.toLowerCase().includes('сша') || polygonName.toLowerCase().includes('usa') || polygonName.toLowerCase().includes('united states')) {
          // Для США
          if (lon >= -180 && lon <= -140 && lat >= 50 && lat <= 72) {
            partName = 'Аляска';
          } else if (lon >= -165 && lon <= -154 && lat >= 18 && lat <= 23) {
            partName = 'Гавайи';
          } else {
            partName = `Отдельная территория ${sortedIndex}`;
          }
        } else if (polygonName.toLowerCase().includes('франция') || polygonName.toLowerCase().includes('france')) {
          // Для Франции (заморские территории)
          if (lat < 0) {
            partName = 'Заморские территории (юг)';
          } else if (lon < -50) {
            partName = 'Заморские территории (запад)';
          } else {
            partName = `Заморская территория ${sortedIndex}`;
          }
        } else {
          // Общая логика для других стран
          partName = `Отдельная территория ${sortedIndex}`;
        }
      }const isHoveredPart = hoveredPart?.polygonIndex === polygonIndex && hoveredPart?.partIndex === originalIndex;

      return (
        <ListItemButton
          key={`${polygonIndex}-part-${originalIndex}`}
          sx={{
            pl: 4, // Отступ для вложенного элемента
            py: 0.5,
            borderRadius: 1,
            mx: 1,
            '&:hover': {
              bgcolor: theme.palette.action.hover,
            },
            ...(isHoveredPart && {
              boxShadow: `0 0 0 2px ${iconColor}`,
              bgcolor: theme.palette.action.hover,
            }),
            display: 'flex',
            alignItems: 'center',
          }}
          onDoubleClick={() => {
            // Навигация к конкретной части
            if (onPolygonPartZoom) {
              onPolygonPartZoom(polygonIndex, originalIndex);
            } else {
              // Fallback к общему зуму полигона
              handlePolygonDoubleClick(polygonIndex);
            }
          }}          onMouseEnter={() => {
            setHoveredPart({ polygonIndex, partIndex: originalIndex });
            onPolygonPartHover?.(polygonIndex, originalIndex);
          }}
          onMouseLeave={() => {
            setHoveredPart(null);
            onPolygonPartHover?.(polygonIndex, null);
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <MapIcon fontSize="small" sx={{ color: iconColor }} />
          </ListItemIcon>
          <ListItemText 
            primary={partName}
            secondary={`${areaKm2} км²`}
            primaryTypographyProps={{ variant: 'body2' }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
          
          {/* Кнопки для частей полигона */}
          <IconButton
            size="small"
            onClick={e => {
              e.stopPropagation();
              handleDownloadPolygonPart(polygonIndex, originalIndex, partName);
            }}
            sx={{ ml: 1, color: iconColor }}
            title="Скачать часть как GeoJSON"
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={e => {
              e.stopPropagation();
              handleTogglePartVisibility(polygonIndex, originalIndex);
            }}
            sx={{ ml: 0.5, color: iconColor }}
            title="Переключить видимость части"
          >
            {getPartVisibility(polygonIndex, originalIndex) ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={e => {
              e.stopPropagation();
              handleDeletePolygonPart(polygonIndex, originalIndex);
            }}
            sx={{ ml: 0.5, color: iconColor }}
            title="Удалить часть"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </ListItemButton>
      );
    });
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
            ) : (              aoiPolygons.map((polygon, index) => {
                let areaText = 'Область исследования';
                let geometry: Polygon | MultiPolygon | null = null;
                let isMultiPolygon = false;
                
                try {
                  const format = new GeoJSON();
                  const feature = format.readFeature(polygon, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857',
                  });
                  
                  if (Array.isArray(feature)) {
                    console.warn('Получен массив фичей, ожидалась одна фича');
                    areaText = 'Ошибка данных';
                  } else {                    geometry = feature.getGeometry() as Polygon | MultiPolygon;
                    if (geometry && (geometry instanceof Polygon || geometry instanceof MultiPolygon)) {
                      const areaM2 = getArea(geometry, { projection: 'EPSG:3857' });
                      const areaKm2 = (areaM2 / 1_000_000).toFixed(2);
                      
                      isMultiPolygon = geometry instanceof MultiPolygon && shouldShowPolygonParts(polygon, geometry as MultiPolygon);
                      
                      if (geometry instanceof MultiPolygon) {
                        const partsCount = (geometry as MultiPolygon).getPolygons().length;
                        if (isMultiPolygon) {
                          // Показываем количество частей только если они будут отображаться отдельно
                          areaText = `${areaKm2} км² (${partsCount} ${partsCount === 1 ? 'часть' : 'частей'})`;
                        } else {
                          // Не показываем части, объединяем площадь
                          areaText = `${areaKm2} км²`;
                        }
                      } else {
                        areaText = `${areaKm2} км²`;
                      }
                    }
                  }
                } catch (error) {
                  console.error('Ошибка при расчете площади полигона:', error);
                  areaText = 'Ошибка расчета';
                }

                const isVisible = polygonVisibility[index] !== false;
                const isExpanded = expandedPolygons.has(index);
                const iconColor = theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main;

                // Определяем название полигона
                let polygonName = `Полигон AOI ${index + 1}`;
                if (polygon.properties?.name) {
                  polygonName = polygon.properties.name;
                } else if (polygon.properties?.source === 'quick_polygon') {
                  polygonName = `Территория ${index + 1}`;
                }

                return (
                  <React.Fragment key={index}>
                    <ListItemButton
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
                    >                      {/* Кнопка развертывания для MultiPolygon */}
                      {isMultiPolygon && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePolygonExpanded(index);
                          }}
                          sx={{ mr: 0.5, color: iconColor }}
                        >
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      )}
                      
                      <ListItemIcon sx={{ minWidth: isMultiPolygon ? 32 : 40 }}>
                        <SatelliteIcon sx={{ color: iconColor }} />
                      </ListItemIcon>
                      
                      <ListItemText 
                        primary={polygonName}
                        secondary={areaText}
                      />
                      
                      <IconButton
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
                    </ListItemButton>                    {/* Вложенный список для частей MultiPolygon */}
                    {isMultiPolygon && geometry && (
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        {renderPolygonParts(geometry as MultiPolygon, index, polygonName)}
                      </Collapse>
                    )}
                  </React.Fragment>
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
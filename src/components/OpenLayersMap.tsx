import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import BingMaps from 'ol/source/BingMaps';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { Box, useTheme } from '@mui/material';
import { Attribution, defaults as defaultControls } from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import { Draw, Modify, Snap } from 'ol/interaction';
import Polygon from 'ol/geom/Polygon';
import MultiPolygon from 'ol/geom/MultiPolygon';
import Point from 'ol/geom/Point';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import { getArea } from 'ol/sphere';
import { Overlay } from 'ol';
import Feature from 'ol/Feature';
import { Coordinate } from 'ol/coordinate';
import simplify from '@turf/simplify';
import { API_CONFIG } from '../config/apiConfig';

// Тип для ref
export interface OpenLayersMapHandle {
  loadGeoJSON: (geoJSON: any, onPolygonsLoaded?: (polygons: any[]) => void, colorByHealth?: boolean) => void;
  clearAllFeatures: () => void;
  disableDrawingMode: () => void;
  showTemporaryRectangle: () => void;
  clearTemporaryRectangle: () => void;
  exportFeatures: () => any[];
  displayGeoReferencedImage: (imageData: string, worldFile: any) => void;
  togglePolygonsVisibility: () => void;
  getPolygonImageBase64: () => Promise<string>;
  replacePolygonImage: (base64Image: string) => void;
  navigateToPolygon: (index: number) => void;
  getLoadedPolygons: () => any[];
  removePolygonByIndex: (index: number) => void;
  setPolygonVisibilityByIndex: (index: number, visible: boolean) => void;  setPolygonHoverByIndex: (index: number, hovered: boolean) => void; // Новая функция для установки наведения
  addGeoJSONFeature: (geoJSON: any) => void; // Добавить GeoJSON фичу на карту
  navigateToPolygonPart: (polygonIndex: number, partIndex: number) => void; // Навигация к части MultiPolygon
  setPolygonPartVisibilityByIndex: (polygonIndex: number, partIndex: number, visible: boolean) => void; // Видимость части
  setPolygonPartHoverByIndex: (polygonIndex: number, partIndex: number, hovered: boolean) => void; // Подсветка части
  removePolygonPartByIndex: (polygonIndex: number, partIndex: number) => void; // Удаление части
}

interface OpenLayersMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  center?: [number, number];
  zoom?: number;
  drawingTool?: 'polygon' | 'rectangle' | null;
  onFeatureAdded?: (feature: any) => void;
  onFeatureCountChange?: (count: number) => void;
  currentLayer?: string;
  overlaySettings?: {
    borders: boolean;
    contour: boolean;
    labels: boolean;
    roads: boolean;
  };
  onTemporaryRectangleConfirm?: () => void;
  currentComposite?: string | null;
  onPolygonCenterChange?: (polygonCenter: [number, number] | null) => void;
}

const OpenLayersMap = forwardRef<OpenLayersMapHandle, OpenLayersMapProps>(
  (
    {
      initialCenter = [37.6173, 55.7558],
      initialZoom = 10,
      center,
      zoom,
      drawingTool,
      onFeatureAdded,
      onFeatureCountChange,
      currentLayer = 'OSM',
      overlaySettings = {
        borders: false,
        contour: false,
        labels: true,
        roads: false
      },
      onTemporaryRectangleConfirm,
      currentComposite,
      onPolygonCenterChange
    },
    ref,
  ) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<Map | null>(null);
    const vectorSourceRef = useRef<VectorSource | null>(null);
    const vectorLayerRef = useRef<VectorLayer | null>(null);
    const drawInteractionRef = useRef<Draw | null>(null);
    const snapInteractionRef = useRef<Snap | null>(null);
    const baseLayerRef = useRef<TileLayer | null>(null);
    const overlayLayersRef = useRef<{
      borders?: TileLayer;
      contour?: TileLayer;
      labels?: TileLayer;
      roads?: TileLayer;
    }>({});    const currentZoomRef = useRef<number>(initialZoom);
    const currentCenterRef = useRef<[number, number]>(initialCenter);
    const theme = useTheme();
    const temporaryFeatureRef = useRef<Feature | null>(null);
    const overlayRef = useRef<Overlay | null>(null);
    const temporaryDivRef = useRef<HTMLDivElement | null>(null);    const imageLayerRef = useRef<ImageLayer<Static> | null>(null);
    const loadedPolygonsRef = useRef<Feature[]>([]);
    
    // Функция для определения, нужно ли разбивать мультиполигон на части
    const shouldShowPolygonParts = (feature: Feature, geometry: MultiPolygon): boolean => {
      // Получаем количество частей
      const partsCount = geometry.getPolygons().length;
      
      // Если только одна часть, то не разбиваем
      if (partsCount <= 1) return false;
      
      // Получаем свойства фичи
      const properties = feature.getProperties();
      const polygonType = properties?.type?.toLowerCase();
      const polygonName = properties?.name?.toLowerCase() || '';
      const polygonParent = properties?.parent?.toLowerCase() || '';
      
      // Не разбиваем административные единицы на части (регионы, области, края и т.д.)
      if (polygonType === 'state' || polygonType === 'region' || polygonType === 'province') {
        return false;
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
        return false;
      }
      
      // Проверяем, является ли это страной с административными единицами
      if (polygonType === 'country' || polygonName.includes('страна') || polygonParent === '') {
        // Если у страны слишком много частей (больше 10), это скорее всего административные единицы
        if (partsCount > 10) {
          return false;
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
    
    // Дебаунсинг для обновления центра полигона
    const updatePolygonCenterDebounced = useCallback(() => {
      if (onPolygonCenterChange) {
        const polygonCenter = calculatePolygonCenterInPixels();
        onPolygonCenterChange(polygonCenter);
      }
    }, [onPolygonCenterChange]);

    // Создаем дебаунсированную версию функции
    const debouncedUpdateRef = useRef<NodeJS.Timeout | null>(null);
    const schedulePolygonCenterUpdate = useCallback(() => {
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
      }
      debouncedUpdateRef.current = setTimeout(updatePolygonCenterDebounced, 16); // ~60fps
    }, [updatePolygonCenterDebounced]);// Function to clear existing image layer
    const clearImageLayer = useCallback(() => {
      if (imageLayerRef.current && mapInstanceRef.current) {
        console.log('Clearing existing image layer');
        mapInstanceRef.current.removeLayer(imageLayerRef.current);
        imageLayerRef.current = null;
        
        // Убеждаемся, что векторный слой все еще на месте
        if (vectorLayerRef.current) {
          const layers = mapInstanceRef.current.getLayers();
          const hasVectorLayer = layers.getArray().includes(vectorLayerRef.current);
          if (!hasVectorLayer) {
            console.log('Re-adding vector layer');
            mapInstanceRef.current.addLayer(vectorLayerRef.current);
          }
        }
      }
    }, []);    // Кэш для центра полигона
    const polygonCenterCacheRef = useRef<{
      featuresCount: number;
      center: [number, number] | null;
      viewState: string;
    }>({ featuresCount: 0, center: null, viewState: '' });

    // Function to calculate polygon center and convert to screen coordinates
    const calculatePolygonCenterInPixels = useCallback(() => {
      if (!mapInstanceRef.current || !vectorSourceRef.current) return null;

      const features = vectorSourceRef.current.getFeatures();
      if (features.length === 0) return null;

      // Создаем ключ состояния вида для кэширования
      const view = mapInstanceRef.current.getView();
      const viewState = `${view.getCenter()?.join(',')}_${view.getResolution()}`;
      const cache = polygonCenterCacheRef.current;

      // Проверяем кэш
      if (cache.featuresCount === features.length && cache.viewState === viewState && cache.center) {
        return cache.center;
      }

      // Get the last added polygon
      const lastFeature = features[features.length - 1];
      const geometry = lastFeature.getGeometry();

      if (!geometry || !(geometry instanceof Polygon || geometry instanceof MultiPolygon)) return null;

      // Calculate the center of the polygon extent
      const extent = geometry.getExtent();
      const centerX = (extent[0] + extent[2]) / 2;
      const centerY = (extent[1] + extent[3]) / 2;

      // Convert map coordinates to screen pixels
      const pixel = mapInstanceRef.current.getPixelFromCoordinate([centerX, centerY]);
      if (!pixel) return null;

      const result: [number, number] = [pixel[0], pixel[1]];
      
      // Обновляем кэш
      polygonCenterCacheRef.current = {
        featuresCount: features.length,
        center: result,
        viewState: viewState
      };

      return result;
    }, []);

    // Function to convert world file data to extent
    const worldFileToExtent = useCallback((worldFile: any, imageWidth?: number, imageHeight?: number) => {
      console.log('Converting world file to extent:', worldFile);
      console.log('Image dimensions:', imageWidth, 'x', imageHeight);
      
      // Проверяем, что worldFile содержит нужные данные
      if (!Array.isArray(worldFile) || worldFile.length < 6) {
        console.error('Invalid world file format. Expected array with 6 elements:', worldFile);
        return null;
      }
      
      // World file format: [pixelSizeX, rotationY, rotationX, pixelSizeY, originX, originY]
      const [pixelSizeX, rotationY, rotationX, pixelSizeY, originX, originY] = worldFile;
      
      // Проверяем, что все значения являются числами
      if ([pixelSizeX, rotationY, rotationX, pixelSizeY, originX, originY].some(val => typeof val !== 'number' || isNaN(val))) {
        console.error('Invalid numeric values in world file:', worldFile);
        return null;
      }
      
      // Use provided dimensions or fallback to default
      const width = imageWidth || 1024;
      const height = imageHeight || 1024;
      
      console.log('Using world file parameters:', {
        pixelSizeX, rotationY, rotationX, pixelSizeY, originX, originY
      });
      
      // Calculate extent based on image size and world file parameters
      // World file coordinates are usually for the center of the top-left pixel
      const minX = originX;
      const maxY = originY;
      const maxX = originX + (width * pixelSizeX);
      const minY = originY + (height * pixelSizeY);
      
      const extent = [minX, minY, maxX, maxY];
      console.log('Calculated extent:', extent);
      
      // Дополнительная проверка валидности экстента
      if (extent.some(val => !isFinite(val))) {
        console.error('Calculated extent contains invalid values:', extent);
        return null;
      }
      
      return extent;
    }, []);

    // Функция для обновления видимости overlay слоев
    const updateOverlayVisibility = () => {
      if (!overlayLayersRef.current) return;
      
      Object.entries(overlaySettings).forEach(([key, visible]) => {
        const layer = overlayLayersRef.current[key as keyof typeof overlayLayersRef.current];
        if (layer) {
          layer.setVisible(visible);
        }
      });
    };    // Создание базовых слоев карты
    const createBaseLayer = (layerType: string): TileLayer => {
      // Базовые настройки производительности для всех слоев
      const baseOptions = {
        preload: 1, // Предзагрузка одного уровня
        maxZoom: 19, // Ограничиваем максимальный зум
        transition: 250, // Плавные переходы между тайлами
      };

      switch (layerType) {
        case 'BingAerial':
          return new TileLayer({
            source: new BingMaps({
              key: API_CONFIG.BING_MAPS_KEY,
              imagerySet: 'Aerial',
              ...baseOptions,
            }),
          });
        case 'YandexSatellite':
          return new TileLayer({
            source: new XYZ({
              url: API_CONFIG.TILE_URLS.YANDEX,
              ...baseOptions,
            }),
          });
        case 'GoogleSatellite':
          return new TileLayer({
            source: new XYZ({
              url: API_CONFIG.TILE_URLS.GOOGLE,
              ...baseOptions,
            }),
          });
        case 'ESRISatellite':
          return new TileLayer({
            source: new XYZ({
              url: API_CONFIG.TILE_URLS.ESRI_SAT,
              ...baseOptions,
            }),
          });
        case 'ESRIStreet':
          return new TileLayer({
            source: new XYZ({
              url: API_CONFIG.TILE_URLS.ESRI_STREET,
              ...baseOptions,
            }),
          });
        case 'OSM':
        default:
          return new TileLayer({
            source: new OSM({
              ...baseOptions,
            }),
          });
      }
    };    
    const createOverlayLayers = (layerType: string) => {
      const layers: { [key: string]: TileLayer } = {};

      const overlayOptions = {
        preload: 0, // Не предзагружаем overlay слои
        maxZoom: 18,
        transition: 150, // Быстрее переходы для overlay
      };

      layers.borders = new TileLayer({
        source: new XYZ({
          url: API_CONFIG.TILE_URLS.BORDERS,
          ...overlayOptions,
        }),
        opacity: 0.7,
        visible: false
      });

      layers.contour = new TileLayer({
        source: new XYZ({
          url: API_CONFIG.TILE_URLS.CONTOUR,
          ...overlayOptions,
        }),
        opacity: 0.6,
        visible: false
      });

      layers.labels = new TileLayer({
        source: new XYZ({
          url: API_CONFIG.TILE_URLS.LABELS,
          ...overlayOptions,
        }),
        opacity: 1.0,
        visible: true
      });      const createRoadLayer = () => {
        switch (layerType) {
          case 'BingAerial':
            return new TileLayer({
              source: new XYZ({
                url: API_CONFIG.TILE_URLS.BING_ROADS,
                ...overlayOptions,
              }),
              opacity: 0.8,
              visible: false
            });
          case 'YandexSatellite':
            return new TileLayer({
              source: new XYZ({
                url: API_CONFIG.TILE_URLS.YANDEX_ROADS,
                ...overlayOptions,
              }),
              opacity: 0.8,
              visible: false
            });
          case 'GoogleSatellite':
            return new TileLayer({
              source: new XYZ({
                url: API_CONFIG.TILE_URLS.GOOGLE_ROADS,
                ...overlayOptions,
              }),
              opacity: 0.8,
              visible: false
            });
          case 'ESRISatellite':
            return new TileLayer({
              source: new XYZ({
                url: API_CONFIG.TILE_URLS.ESRI_TRANSPORT,
                ...overlayOptions,
              }),
              opacity: 0.8,
              visible: false
            });
        case 'ESRIStreet':
        case 'OSM':
        default:
          return new TileLayer({
            source: new XYZ({
              url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
              ...overlayOptions,
            }),
            opacity: 0,
            visible: false
          });
      }
    };

    layers.roads = createRoadLayer();

    return layers;
  };

  // Стиль для отображения фигур с белыми точками на углах и меткой площади
  const createVectorStyle = () => {
    return (feature: any) => {
      const styles: Style[] = [];
      const geometry = feature.getGeometry();      if (geometry instanceof Polygon) {
        // Основной стиль для фигуры (без заливки, только грани)
        styles.push(
          new Style({
            stroke: new Stroke({
              color: '#00b3b3',
              width: 2,
            }),
          })
        );

        // Добавляем белые точки на углах
        const coordinates = geometry.getCoordinates()[0] as Coordinate[];
        coordinates.slice(0, -1).forEach((coord: Coordinate) => {
          styles.push(
            new Style({
              geometry: new Point(coord),
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({
                  color: '#ffffff',
                }),
                stroke: new Stroke({
                  color: '#00b3b3',
                  width: 2,
                }),
              }),
            })
          );
        });

        // Вычисляем площадь в квадратных километрах
        const areaM2 = getArea(geometry, { projection: 'EPSG:3857' });
        const areaKm2 = (areaM2 / 1_000_000).toFixed(2); // Конвертируем в км² и округляем до 2 знаков

        // Находим верхнюю грань (наименьший Y, самый верхний в проекции EPSG:3857)
      const topPoint = coordinates.slice(0, -1).reduce((top: Coordinate, coord: Coordinate) => {
        return coord[1] > top[1] ? coord : top;
      }, coordinates[0]);

      // Находим левую точку среди координат верхней грани
      const leftTopPoint = coordinates.slice(0, -1)
        .filter((coord: Coordinate) => Array.isArray(coord) && coord.length >= 2 && Math.abs(coord[1] - topPoint[1]) < 0.0001)
        .reduce((left: Coordinate, coord: Coordinate) => {
          return coord[0] < left[0] ? coord : left;
        }, topPoint);

        // Добавляем метку с площадью над верхней гранью, ближе к левому краю
        styles.push(
          new Style({
            geometry: new Point(leftTopPoint),
            text: new Text({
              text: `${areaKm2} км²`,
              font: '12px Arial',
              fill: new Fill({ color: '#ffffff' }),
              backgroundFill: new Fill({ color: '#000000' }),
              padding: [2, 2, 2, 2],
              offsetY: -15, // Смещение вверх
              offsetX: 10, // Небольшое смещение вправо от левого края
              textAlign: 'left',
              overflow: true,
            }),
          })
        );      } else if (geometry instanceof MultiPolygon) {
        // Проверяем, нужно ли разбивать MultiPolygon на части
        const shouldShowParts = shouldShowPolygonParts(feature, geometry);
        const polygons = geometry.getPolygons();
        // Основной стиль для MultiPolygon
        if (shouldShowParts) {
          polygons.forEach((polygon, index) => {
            // Проверяем видимость конкретной части
            const partVisibilityKey = `part_${index}_visible`;
            const isPartVisible = feature.get(partVisibilityKey);
            
            // Если видимость части явно установлена в false, пропускаем её
            if (isPartVisible === false) {
              return;
            }
            
            // Основной стиль для каждого полигона в мультиполигоне
            styles.push(
              new Style({
                geometry: polygon, // Применяем стиль к конкретному полигону
                stroke: new Stroke({
                  color: '#00b3b3',
                  width: 2,
                }),
              })
            );

            // Добавляем точки на углах для каждого видимого полигона
            const coordinates = polygon.getCoordinates()[0] as Coordinate[];
            coordinates.slice(0, -1).forEach((coord: Coordinate) => {
              styles.push(
                new Style({
                  geometry: new Point(coord),
                  image: new CircleStyle({
                    radius: 4,
                    fill: new Fill({
                      color: '#ffffff',
                    }),
                    stroke: new Stroke({
                      color: '#00b3b3',
                      width: 2,
                    }),
                  }),
                })
              );
            });
          });
        } else {
          // Отображаем MultiPolygon как единый полигон
          styles.push(
            new Style({
              stroke: new Stroke({
                color: '#00b3b3',
                width: 2,
              }),
            })
          );
          // Добавляем точки на углах для всех внешних контуров
          polygons.forEach(polygon => {
            const coordinates = polygon.getCoordinates()[0] as Coordinate[];
            coordinates.slice(0, -1).forEach((coord: Coordinate) => {
              styles.push(
                new Style({
                  geometry: new Point(coord),
                  image: new CircleStyle({
                    radius: 4,
                    fill: new Fill({ color: '#ffffff' }),
                    stroke: new Stroke({ color: '#00b3b3', width: 2 }),
                  }),
                })
              );
            });
          });
          // === КИЛОМЕТРАЖ ЛЕЙБЛ ДЛЯ СЛОЖНЫХ ФИГУР ===
          // Находим верхнюю грань (наибольший Y)
          let leftTopPoint: Coordinate | null = null;
          let topY = -Infinity;
          polygons.forEach(polygon => {
            const coords = polygon.getCoordinates()[0] as Coordinate[];
            coords.slice(0, -1).forEach(coord => {
              if (coord[1] > topY) topY = coord[1];
            });
          });
          // Среди всех точек с этим Y ищем минимальный X
          let minX = Infinity;
          polygons.forEach(polygon => {
            const coords = polygon.getCoordinates()[0] as Coordinate[];
            coords.slice(0, -1).forEach(coord => {
              if (Math.abs(coord[1] - topY) < 0.0001 && coord[0] < minX) {
                minX = coord[0];
                leftTopPoint = coord;
              }
            });
          });
          if (leftTopPoint) {
            const areaM2 = getArea(geometry, { projection: 'EPSG:3857' });
            const areaKm2 = (areaM2 / 1_000_000).toFixed(2);
            styles.push(
              new Style({
                geometry: new Point(leftTopPoint),
                text: new Text({
                  text: `${areaKm2} км²`,
                  font: '12px Arial',
                  fill: new Fill({ color: '#ffffff' }),
                  backgroundFill: new Fill({ color: '#000000' }),
                  padding: [2, 2, 2, 2],
                  offsetY: -15,
                  offsetX: 10,
                  textAlign: 'left',
                  overflow: true,
                }),
              })
            );
          }
        }
      }

      return styles;
    };
  };
  // Стиль для выделения полигона при наведении
  const createHoverStyle = () => {
    return (feature: any) => {
      const styles: Style[] = [];
      const geometry = feature.getGeometry();

      if (geometry instanceof Polygon) {
        // Основной стиль для выделения полигона (жирная/яркая обводка)
        styles.push(
          new Style({
            stroke: new Stroke({
              color: theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main,
              width: 4,
            }),
            fill: new Fill({
              color: 'rgba(0,229,197,0.08)', // легкая подсветка
            }),
          })
        );
      } else if (geometry instanceof MultiPolygon) {
        // Для MultiPolygon применяем выделение ко всем видимым частям
        const polygons = geometry.getPolygons();
        
        polygons.forEach((polygon, index) => {
          // Проверяем видимость конкретной части
          const partVisibilityKey = `part_${index}_visible`;
          const isPartVisible = feature.get(partVisibilityKey);
          
          // Если видимость части явно установлена в false, пропускаем её
          if (isPartVisible === false) {
            return;
          }
          
          // Основной стиль для выделения каждого видимого полигона
          styles.push(
            new Style({
              geometry: polygon, // Применяем стиль к конкретному полигону
              stroke: new Stroke({
                color: theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main,
                width: 4,
              }),
              fill: new Fill({
                color: 'rgba(0,229,197,0.08)', // легкая подсветка
              }),
            })
          );
        });
      }
      
      return styles;
    };
  };

  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;    const vectorSource = new VectorSource({
      // Настройки производительности для векторного источника
      wrapX: false, // Отключаем обертку по X для лучшей производительности
    });
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createVectorStyle(),
      zIndex: 100, // Высокий zIndex для векторного слоя, чтобы он был поверх всех остальных
      // Настройки производительности
      updateWhileAnimating: false, // Не обновляем во время анимации
      updateWhileInteracting: false, // Не обновляем во время взаимодействия
    });

    vectorSourceRef.current = vectorSource;
    vectorLayerRef.current = vectorLayer;

    const baseLayer = createBaseLayer(currentLayer);
    baseLayerRef.current = baseLayer;

    const overlayLayers = createOverlayLayers(currentLayer);
    overlayLayersRef.current = overlayLayers;

    const attribution = new Attribution({
      collapsible: false,
    });    const map = new Map({
      target: mapRef.current,
      layers: [
        baseLayer,
        ...Object.values(overlayLayers),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat(initialCenter),
        zoom: initialZoom,
        // Добавляем настройки для улучшения производительности
        constrainResolution: true, // Ограничиваем разрешение для более плавного зуммирования
        enableRotation: false, // Отключаем поворот для лучшей производительности
      }),
      controls: defaultControls({ attribution: false }).extend([attribution]),
      // Настройки производительности
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2), // Ограничиваем pixel ratio для лучшей производительности
    });vectorSource.on('addfeature', () => {
      if (onFeatureCountChange) {
        onFeatureCountChange(vectorSource.getFeatures().length);
      }
      
      // Дебаунсированное обновление центра полигона
      schedulePolygonCenterUpdate();
    });

    vectorSource.on('removefeature', () => {
      if (onFeatureCountChange) {
        onFeatureCountChange(vectorSource.getFeatures().length);
      }
      
      // Дебаунсированное обновление центра полигона
      schedulePolygonCenterUpdate();
      
      // Удаляем изображение при удалении полигона
      clearImageLayer();
    });

    mapInstanceRef.current = map;    map.getView().on('change:center', () => {
      currentCenterRef.current = toLonLat(map.getView().getCenter() as [number, number]) as [number, number];
      
      // Дебаунсированное обновление центра полигона
      schedulePolygonCenterUpdate();
    });

    map.getView().on('change:resolution', () => {
      currentZoomRef.current = map.getView().getZoom() || initialZoom;
      
      // Дебаунсированное обновление центра полигона
      schedulePolygonCenterUpdate();
    });    return () => {
      // Очищаем таймер дебаунсинга
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
      }
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
  }, [onFeatureCountChange]); // Убираем currentLayer из зависимостей  // Обновление базового слоя при изменении currentLayer
  useEffect(() => {
    if (mapInstanceRef.current && baseLayerRef.current && vectorLayerRef.current) {
      // Сохраняем текущий центр и зум перед обновлением слоев
      const currentCenter = currentCenterRef.current;
      const currentZoom = currentZoomRef.current;

      // Временно сохраняем векторный слой с фигурами и слой изображения
      const vectorLayer = vectorLayerRef.current;
      const imageLayer = imageLayerRef.current;
      
      mapInstanceRef.current.removeLayer(vectorLayer);
      if (imageLayer) {
        mapInstanceRef.current.removeLayer(imageLayer);
      }

      // Удаляем старый базовый слой
      mapInstanceRef.current.removeLayer(baseLayerRef.current);

      // Удаляем старые overlay слои
      Object.values(overlayLayersRef.current).forEach(layer => {
        if (layer) {
          mapInstanceRef.current?.removeLayer(layer);
        }
      });

      // Создаем и добавляем новый базовый слой
      const newBaseLayer = createBaseLayer(currentLayer);
      baseLayerRef.current = newBaseLayer;

      // Создаем новые overlay слои
      const newOverlayLayers = createOverlayLayers(currentLayer);
      overlayLayersRef.current = newOverlayLayers;

      // Добавляем слои в правильном порядке:
      // 1. Базовый слой (фон)
      mapInstanceRef.current.addLayer(newBaseLayer);
      
      // 2. Overlay слои (границы, контуры, дороги, подписи)
      Object.values(newOverlayLayers).forEach(layer => {
        mapInstanceRef.current?.addLayer(layer);
      });
      
      // 3. Слой изображения (если есть)
      if (imageLayer) {
        mapInstanceRef.current.addLayer(imageLayer);
      }
      
      // 4. Векторный слой с фигурами всегда сверху
      mapInstanceRef.current.addLayer(vectorLayer);

      // Восстанавливаем текущий центр и зум
      const view = mapInstanceRef.current.getView();
      view.setCenter(fromLonLat(currentCenter));
      view.setZoom(currentZoom);

      // Применяем текущие настройки overlay
      updateOverlayVisibility();
    }
  }, [currentLayer]);

  // Обновление центра и зума
  useEffect(() => {
    if (mapInstanceRef.current && center && zoom !== undefined) {
      const view = mapInstanceRef.current.getView();
      view.setCenter(fromLonLat(center));
      view.setZoom(zoom);
    }
  }, [center, zoom]);

  // Управление взаимодействиями рисования
  useEffect(() => {
    if (!mapInstanceRef.current || !vectorSourceRef.current || !mapRef.current) return;

    if (drawInteractionRef.current) {
      mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    if (snapInteractionRef.current) {
      mapInstanceRef.current.removeInteraction(snapInteractionRef.current);
      snapInteractionRef.current = null;
    }

    if (!drawingTool) {
      mapRef.current.style.cursor = '';
      return;
    }

    mapRef.current.style.cursor = 'crosshair';

  const drawingStyle = (feature: any) => {
    const styles: Style[] = [];
    const geometry = feature.getGeometry();

    if (geometry instanceof Polygon) {
      // Основной стиль для фигуры во время рисования (без заливки)
      styles.push(
        new Style({
          stroke: new Stroke({
            color: '#00b3b3',
            width: 2,
            lineDash: drawingTool === 'polygon' ? [5, 5] : undefined,
          }),
        })
      );

      // Добавляем белые точки на углах
      const coordinates = geometry.getCoordinates()[0] as Coordinate[];
      coordinates.slice(0, -1).forEach((coord: Coordinate) => {
        styles.push(
          new Style({
            geometry: new Point(coord),
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({
                color: '#ffffff',
              }),
              stroke: new Stroke({
                color: '#00b3b3',
                width: 2,
              }),
            }),
          })
        );
      });

      // Вычисляем площадь в квадратных километрах
      const areaM2 = getArea(geometry, { projection: 'EPSG:3857' });
      const areaKm2 = (areaM2 / 1_000_000).toFixed(2);

      // Находим верхнюю грань (наибольший Y, самый верхний в проекции EPSG:3857)
      const topPoint = coordinates.slice(0, -1).reduce((top: Coordinate, coord: Coordinate) => {
        return coord[1] > top[1] ? coord : top;
      }, coordinates[0]);

      // Находим левую точку среди координат верхней грани
      const leftTopPoint = coordinates.slice(0, -1)
        .filter((coord: Coordinate) => Array.isArray(coord) && coord.length >= 2 && Math.abs(coord[1] - topPoint[1]) < 0.0001)
        .reduce((left: Coordinate, coord: Coordinate) => {
          return coord[0] < left[0] ? coord : left;
        }, topPoint);

      styles.push(
        new Style({
          geometry: new Point(leftTopPoint),
          text: new Text({
            text: `${areaKm2} км²`,
            font: '12px Arial',
            fill: new Fill({ color: '#ffffff' }),
            backgroundFill: new Fill({ color: '#000000' }),
            padding: [2, 2, 2, 2],
            offsetY: -15, // Смещение вверх
            offsetX: 10, // Небольшое смещение вправо от левого края
            textAlign: 'left',
            overflow: true,
          }),
        })
      );
    }

    return styles;
  };

    const geometryType = drawingTool === 'polygon' ? 'Polygon' : 'Circle';
    const geometryFunction =
      drawingTool === 'rectangle'
        ? (coordinates: any, geometry: any) => {
            if (!geometry) {
              geometry = new Polygon([]);
            }
            const start = coordinates[0];
            const end = coordinates[1];
            geometry.setCoordinates([
              [start, [start[0], end[1]], end, [end[0], start[1]], start],
            ]);
            return geometry;
          }
        : undefined;

    const draw = new Draw({
      source: vectorSourceRef.current,
      type: geometryType as any,
      geometryFunction,
      style: drawingStyle,
      freehand: false,
    });

    draw.on('drawend', (event) => {
      const feature = event.feature;
      // Упрощаем геометрию полигона через turf.simplify (Visvalingam-Whyatt)
      const geometry = feature.getGeometry();
      if (geometry && geometry instanceof Polygon) {
        const format = new GeoJSON();
        const geojsonGeom = format.writeGeometryObject(geometry, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        // turf.simplify работает с GeoJSON geometry
        const simplifiedGeojson = simplify(geojsonGeom, { tolerance: 0.00005 });
        // Преобразуем обратно в OpenLayers Polygon
        const simplified = format.readGeometry(simplifiedGeojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        feature.setGeometry(simplified);
      }
      feature.setStyle(createVectorStyle());

      if (onFeatureAdded) {
        const format = new GeoJSON();
        const geoJSON = format.writeFeatureObject(feature, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        onFeatureAdded(geoJSON);
      }
    });

    mapInstanceRef.current.addInteraction(draw);
    const snap = new Snap({
      source: vectorSourceRef.current,
    });
    mapInstanceRef.current.addInteraction(snap);

    drawInteractionRef.current = draw;
    snapInteractionRef.current = snap;
  }, [drawingTool, onFeatureAdded]);

  // Обновление видимости overlay слоев
  useEffect(() => {
    updateOverlayVisibility();
  }, [overlaySettings]);

  // Функция для временного отображения прямоугольника
  const showTemporaryRectangle = useCallback(() => {
    if (!mapInstanceRef.current || !vectorSourceRef.current) return;

    // Удаляем существующий временный прямоугольник, если есть
    if (temporaryFeatureRef.current) {
      vectorSourceRef.current.removeFeature(temporaryFeatureRef.current);
    }

    // Получаем текущий экстент (видимую область) карты
    const extent = mapInstanceRef.current.getView().calculateExtent();
    const [minX, minY, maxX, maxY] = extent;

    // Вычисляем центр и используем высоту для создания квадрата
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const size = (maxY - minY) * 0.4; // Используем 40% высоты для квадрата

    // Создаем координаты квадрата
    const rectangleCoords = [
      [
        [centerX - size/2, centerY - size/2],
        [centerX + size/2, centerY - size/2],
        [centerX + size/2, centerY + size/2],
        [centerX - size/2, centerY + size/2],
        [centerX - size/2, centerY - size/2]
      ]
    ];

    // Создаем и добавляем новый временный прямоугольник
    const feature = new Feature({
      geometry: new Polygon(rectangleCoords)
    });

    feature.setStyle(createVectorStyle());
    temporaryFeatureRef.current = feature;
    vectorSourceRef.current.addFeature(feature);

    // Создаем кнопку подтверждения, если еще не создана
    if (!overlayRef.current) {
      const element = document.createElement('div');
      element.className = 'ol-selectable';
      element.style.position = 'absolute';
      element.style.backgroundColor = '#00b3b3';
      element.style.color = 'white';
      element.style.padding = '8px 16px';
      element.style.borderRadius = '4px';
      element.style.cursor = 'pointer';
      element.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      element.style.transform = 'translate(-50%, -50%)';
      element.innerHTML = 'Применить';
      element.onclick = () => {
        if (onTemporaryRectangleConfirm) {
          onTemporaryRectangleConfirm();
        }
      };

      temporaryDivRef.current = element;

      const overlay = new Overlay({
        element: element,
        position: [centerX, centerY],
        positioning: 'center-center'
      });

      mapInstanceRef.current.addOverlay(overlay);
      overlayRef.current = overlay;
    }
  }, [onTemporaryRectangleConfirm]);

  // Функция для очистки временного прямоугольника
  const clearTemporaryRectangle = useCallback(() => {
    if (overlayRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeOverlay(overlayRef.current);
      overlayRef.current = null;
    }

    if (temporaryDivRef.current) {
      temporaryDivRef.current.remove();
      temporaryDivRef.current = null;
    }
    
    temporaryFeatureRef.current = null;
  }, []);
  // Экспонируем функции через ref
  useImperativeHandle(
    ref,
    () => ({
      loadGeoJSON: (geoJSON: any, onPolygonsLoaded?: (polygons: any[]) => void, colorByHealth: boolean = false) => {
        console.log('=== Loading GeoJSON ===');
        console.log('GeoJSON data:', geoJSON);
        
        if (!vectorSourceRef.current || !mapInstanceRef.current) {
          console.error('Vector source or map instance not available');
          return;
        }

        const format = new GeoJSON();
        
        // Проверяем CRS в GeoJSON файле
        const crs = geoJSON.crs?.properties?.name;
        console.log('GeoJSON CRS:', crs);
        
        // Определяем проекцию данных на основе CRS
        let dataProjection = 'EPSG:4326'; // по умолчанию
        if (crs && crs.includes('3857')) {
          dataProjection = 'EPSG:3857';
        }
        
        console.log('Using data projection:', dataProjection);
        
        const features = format.readFeatures(geoJSON, {
          dataProjection: dataProjection,
          featureProjection: 'EPSG:3857',
        });
        console.log('Features loaded:', features.length);
          // Функция для определения цвета на основе значения "Здоровье"
        const getHealthColor = (healthValue: number) => {
          switch (healthValue) {
            case 2:
              return 'rgba(0, 200, 0, 0.6)'; // Зеленый
            case 0:
            case 1:
              return 'rgba(255, 0, 0, 0.6)'; // Красный
            case 3:
              return 'rgba(255, 215, 0, 0.6)'; // Желтый
            default:
              return 'rgba(0,179,179,0.4)'; // Стандартный цвет
          }
        };

        // Функция для определения цвета обводки на основе значения "Здоровье"
        const getHealthStrokeColor = (healthValue: number) => {
          switch (healthValue) {
            case 2:
              return '#008800'; // Темно-зеленый
            case 0:
            case 1:
              return '#880000'; // Темно-красный
            case 3:
              return '#A08800'; // Темно-желтый
            default:
              return '#005555'; // Темно-голубой
          }
        };

        // Создаем стандартный стиль для полигонов резервуаров
        const defaultReservoirStyle = new Style({
          stroke: new Stroke({
            color: '#00b3b3',
            width: 3
          }),
          fill: new Fill({
            color: 'rgba(0,179,179,0.4)'
          })
        });

        features.forEach((feature, index) => {
          if (colorByHealth) {
            // Получаем значение "Здоровье" из свойств объекта
            const properties = feature.getProperties();
            const healthValue = properties?.Здоровье !== undefined ? Number(properties.Здоровье) : undefined;
            console.log(`Feature ${index} health:`, healthValue);
            
            if (healthValue !== undefined) {
              // Создаем индивидуальный стиль на основе значения "Здоровье"
              const healthStyle = new Style({
                stroke: new Stroke({
                  color: getHealthStrokeColor(healthValue),
                  width: 3
                }),
                fill: new Fill({
                  color: getHealthColor(healthValue)
                }),
                // Добавляем текстовую метку с значением id объекта
                text: properties?.fid ? new Text({
                  text: `${properties.fid}`,
                  font: 'bold 14px Arial',
                  fill: new Fill({
                    color: '#FFFFFF'
                  }),
                  stroke: new Stroke({
                    color: '#000000',
                    width: 2
                  }),
                  offsetY: -15
                }) : undefined
              });
              feature.setStyle(healthStyle);
            } else {
              feature.setStyle(defaultReservoirStyle);
            }
          } else {
            // Применяем стандартный стиль
            feature.setStyle(defaultReservoirStyle);
          }
          console.log(`Feature ${index} geometry:`, feature.getGeometry()?.getType());
        });

        // Store loaded polygons in ref for navigation
        loadedPolygonsRef.current = [...features];

        // Очищаем существующие объекты перед добавлением новых
        vectorSourceRef.current.clear();
        vectorSourceRef.current.addFeatures(features);
        
        console.log('Features added to vector source. Total features:', vectorSourceRef.current.getFeatures().length);        if (features.length > 0) {
          const extent = vectorSourceRef.current.getExtent();
          console.log('Calculated extent:', extent);
          
          const view = mapInstanceRef.current.getView();

          view.fit(extent, {
            padding: [20, 20, 20, 20],
            maxZoom: 16,
          });
          
          console.log('Map view fitted to extent');

          // Call the callback with the loaded polygons if provided
          if (onPolygonsLoaded) {
            const polygonData = features.map(feature => 
              format.writeFeatureObject(feature, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857',
              })
            );
            onPolygonsLoaded(polygonData);
          }
          
          // Уведомляем о изменении количества объектов
          if (onFeatureCountChange) {
            onFeatureCountChange(vectorSourceRef.current.getFeatures().length);
          }
        }
        
        console.log('=== GeoJSON loading completed ===');
          // Дополнительная проверка видимости векторного слоя
        if (vectorLayerRef.current) {
          console.log('Vector layer visibility:', vectorLayerRef.current.getVisible());
          console.log('Vector layer z-index:', vectorLayerRef.current.getZIndex());
          
          // Убеждаемся, что векторный слой видим и имеет правильный z-index
          vectorLayerRef.current.setVisible(true);
          vectorLayerRef.current.setZIndex(1000); // Убедимся, что векторный слой поверх остальных слоев
          
          // Убедимся, что текущая карта точно содержит векторный слой
          const layers = mapInstanceRef.current.getLayers();
          const hasVectorLayer = layers.getArray().includes(vectorLayerRef.current);
          
          if (!hasVectorLayer) {
            console.log('Vector layer not in map layers, adding it...');
            mapInstanceRef.current.addLayer(vectorLayerRef.current);
          }
          
          // Принудительно обновляем карту
          mapInstanceRef.current.render();
          
          // Дополнительное сообщение для отладки
          console.log('After rendering - Vector layer visibility:', vectorLayerRef.current.getVisible());
        }
      },
      exportFeatures: () => {
        if (!vectorSourceRef.current) return [];
        
        const format = new GeoJSON();
        const features = vectorSourceRef.current.getFeatures();
        
        return features.map(feature => 
          format.writeFeatureObject(feature, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          })
        );
      },      clearAllFeatures: () => {
        if (vectorSourceRef.current) {
          vectorSourceRef.current.clear();
        }
        // Also clear loaded polygons when clearing all features
        loadedPolygonsRef.current = [];
      },
      disableDrawingMode: () => {
        if (!mapInstanceRef.current || !mapRef.current) return;

        if (drawInteractionRef.current) {
          mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
          drawInteractionRef.current = null;
        }
        if (snapInteractionRef.current) {
          mapInstanceRef.current.removeInteraction(snapInteractionRef.current);
          snapInteractionRef.current = null;
        }

        mapRef.current.style.cursor = '';
      },      showTemporaryRectangle,
      clearTemporaryRectangle,      displayGeoReferencedImage: (imageData: string, worldFile: any) => {        console.log('=== Starting displayGeoReferencedImage (polygon-based placement) ===');
        console.log('Image data length:', imageData?.length || 'undefined');

        // Очистить существующий слой изображения
        clearImageLayer();

        if (!mapInstanceRef.current) {
          console.error('Map instance not available');
          return;
        }

        if (!imageData || imageData.length === 0) {
          console.error('No image data provided or empty image data');
          return;
        }

        if (!vectorSourceRef.current) {
          console.error('Vector source not available');
          return;
        }

        // Получаем все фигуры с карты
        const features = vectorSourceRef.current.getFeatures();
        
        if (features.length === 0) {
          console.error('No polygons found on the map. Please draw a polygon first.');
          return;
        }

        // Берем последний нарисованный полигон
        const lastFeature = features[features.length - 1];
        const geometry = lastFeature.getGeometry();        if (!geometry || !(geometry instanceof Polygon || geometry instanceof MultiPolygon)) {
          console.error('Last feature is not a polygon or multipolygon');
          return;
        }

        // Получаем экстент полигона
        const polygonExtent = geometry.getExtent();
        console.log('Using polygon extent for image placement:', polygonExtent);
        console.log('Polygon extent width:', polygonExtent[2] - polygonExtent[0], 'height:', polygonExtent[3] - polygonExtent[1]);        try {
          // Проверяем, содержит ли imageData уже data: URL или это чистый base64
          let imageUrl: string;
          if (imageData.startsWith('data:image/')) {
            // Данные уже содержат data: URL
            imageUrl = imageData;
            console.log('Image data already contains data: URL');
          } else {
            // Определяем формат изображения из base64
            let imageFormat = 'png';
            if (imageData.startsWith('/9j/') || imageData.startsWith('iVBOR')) {
              imageFormat = imageData.startsWith('/9j/') ? 'jpeg' : 'png';
            }
            // Создаем data: URL из чистого base64
            imageUrl = `data:image/${imageFormat};base64,${imageData}`;
            console.log('Created data: URL for format:', imageFormat);
          }

          console.log('Final image URL (first 100 chars):', imageUrl.substring(0, 100) + '...');

          // Получаем проекцию карты
          const mapProjection = mapInstanceRef.current.getView().getProjection().getCode();
          console.log('Map projection:', mapProjection);

          // Создать новый слой изображения с экстентом полигона
          const imageLayer = new ImageLayer({
            source: new Static({
              url: imageUrl,
              imageExtent: polygonExtent, // Используем экстент полигона вместо world file
              projection: mapProjection, // Используем проекцию карты
              imageLoadFunction: (image: any, src: string) => {
                console.log('Loading image from source:', src.substring(0, 50) + '...');
                const img = image.getImage();
                img.onload = () => {
                  console.log('Image loaded successfully:', img.width, 'x', img.height);
                };
                img.onerror = (error: any) => {
                  console.error('Image load error:', error);
                };
                img.src = src;
              }            }),
            opacity: 1.0, // Полная непрозрачность для четкого отображения изображения
            zIndex: 50 // Средний zIndex между базовыми слоями и векторными
          });

          console.log('Image layer created:', imageLayer);
          
          // Добавляем обработчики событий для слоя
          imageLayer.getSource()?.on('imageloadstart', () => {
            console.log('Image load started');
          });
          
          imageLayer.getSource()?.on('imageloadend', () => {
            console.log('Image load ended');
          });
          
          imageLayer.getSource()?.on('imageloaderror', (error: any) => {
            console.error('Image load error event:', error);
          });          // Получаем все текущие слои для отладки
          const allLayers = mapInstanceRef.current.getLayers();
          console.log('Current layers count before adding image:', allLayers.getLength());

          // Добавляем слой изображения
          mapInstanceRef.current.addLayer(imageLayer);
          imageLayerRef.current = imageLayer;
          
          console.log('Image layer added to map');
          console.log('Current layers count after adding image:', mapInstanceRef.current.getLayers().getLength());

          // Проверяем валидность экстента полигона
          if (polygonExtent.some((val: number) => !isFinite(val))) {
            console.error('Polygon extent contains invalid values:', polygonExtent);
            return;
          }

          // Увеличить масштаб до экстента полигона (где размещено изображение)
          console.log('Fitting view to polygon extent:', polygonExtent);
          mapInstanceRef.current.getView().fit(polygonExtent, {
            padding: [50, 50, 50, 50],
            maxZoom: 18,
            duration: 1000
          });
          
          console.log('=== Image layer successfully placed within polygon ===');
          
          // Дополнительная проверка слоя изображения
          setTimeout(() => {
            const layers = mapInstanceRef.current?.getLayers();
            const hasImageLayer = layers?.getArray().includes(imageLayer);
            console.log('Image layer still in map after timeout:', hasImageLayer);
            console.log('Image layer visibility:', imageLayer.getVisible());
            console.log('Image layer opacity:', imageLayer.getOpacity());
          }, 100);
            } catch (error) {
          console.error('Error creating image layer:', error);
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        }
      },      togglePolygonsVisibility: () => {
        if (vectorLayerRef.current && imageLayerRef.current) {
          // Переключаем видимость как векторного слоя, так и слоя изображения
          const currentVisibility = vectorLayerRef.current.getVisible();
          vectorLayerRef.current.setVisible(!currentVisibility);
          imageLayerRef.current.setVisible(!currentVisibility);
        } else if (vectorLayerRef.current) {
          // Переключаем видимость только векторного слоя
          const currentVisibility = vectorLayerRef.current.getVisible();
          vectorLayerRef.current.setVisible(!currentVisibility);
        }
      },      getPolygonImageBase64: async (): Promise<string> => {
        console.log('=== Начало извлечения изображения полигона ===');
        return new Promise((resolve, reject) => {
          console.log('Проверяем доступность карты и векторного источника...');
          if (!mapInstanceRef.current || !vectorSourceRef.current) {
            console.error('Карта или векторный источник недоступны');
            reject(new Error('Map or vector source not available'));
            return;
          }

          console.log('Получаем список объектов на карте...');
          const features = vectorSourceRef.current.getFeatures();
          console.log('Найдено объектов:', features.length);
          
          if (features.length === 0) {
            console.error('На карте нет полигонов');
            reject(new Error('No polygons found on the map'));
            return;
          }

          // Берем последний нарисованный полигон
          const lastFeature = features[features.length - 1];
          const geometry = lastFeature.getGeometry();
          console.log('Последний объект:', lastFeature);
          console.log('Геометрия объекта:', geometry);          if (!geometry || !(geometry instanceof Polygon || geometry instanceof MultiPolygon)) {
            console.error('Последний объект не является полигоном или мультиполигоном');
            reject(new Error('Last feature is not a polygon or multipolygon'));
            return;
          }

          // Получаем экстент полигона
          const polygonExtent = geometry.getExtent();
          console.log('Экстент полигона:', polygonExtent);
          
          // Определяем размер изображения (фиксированный размер для сегментации)
          const imageSize = 512; // Фиксированный размер для модели сегментации
          
          console.log('Создаем Canvas для извлечения изображения размером:', imageSize, 'x', imageSize);

          // Создаем canvas для рендеринга изображения без фоновых слоев
          const canvas = document.createElement('canvas');
          canvas.width = imageSize;
          canvas.height = imageSize;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Не удалось получить контекст canvas');
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Заливаем canvas черным цветом (фон для сегментации)
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, imageSize, imageSize);

          console.log('Создаем временную карту для извлечения данных...');
          
          // Создаем временный div для рендеринга карты без базовых слоев
          const tempDiv = document.createElement('div');
          tempDiv.style.width = imageSize + 'px';
          tempDiv.style.height = imageSize + 'px';
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.style.top = '-9999px';
          document.body.appendChild(tempDiv);

          // Получаем только слои с данными (исключаем базовые слои)
          const dataLayers: any[] = [];
          mapInstanceRef.current.getLayers().forEach((layer: any) => {
            // Добавляем только векторные слои и слои изображений (не базовые тайловые слои)
            if (layer === vectorLayerRef.current || layer === imageLayerRef.current) {
              dataLayers.push(layer);
            }
          });

          console.log('Найдено слоев с данными:', dataLayers.length);

          // Создаем временную карту только с данными (без базовых слоев)
          const tempMap = new Map({
            target: tempDiv,
            layers: dataLayers,
            view: new View({
              center: [(polygonExtent[0] + polygonExtent[2]) / 2, (polygonExtent[1] + polygonExtent[3]) / 2],
              extent: polygonExtent,
              resolution: Math.max(
                (polygonExtent[2] - polygonExtent[0]) / imageSize,
                (polygonExtent[3] - polygonExtent[1]) / imageSize
              )
            }),
            controls: []
          });

          // Ждем рендеринга временной карты
          tempMap.once('rendercomplete', () => {
            console.log('Временная карта отрендерена');
            
            setTimeout(() => {
              const tempCanvas = tempDiv.querySelector('canvas') as HTMLCanvasElement;
              if (tempCanvas) {
                console.log('Копируем данные из временной карты...');
                
                // Копируем содержимое временной карты
                ctx.drawImage(tempCanvas, 0, 0, imageSize, imageSize);
                
                // Конвертируем в base64
                console.log('Конвертируем в base64...');
                const base64 = canvas.toDataURL('image/png').split(',')[1];
                console.log('Base64 изображение создано, длина:', base64.length);
                
                // Очищаем временные элементы
                document.body.removeChild(tempDiv);
                tempMap.setTarget(undefined);
                
                console.log('=== Извлечение изображения завершено успешно ===');
                resolve(base64);
              } else {
                console.error('Не удалось найти canvas временной карты');
                document.body.removeChild(tempDiv);
                tempMap.setTarget(undefined);
                reject(new Error('Could not find temporary map canvas'));
              }
            }, 500); // Даем время на полную отрисовку
          });

          // Принудительно рендерим временную карту
          tempMap.renderSync();
        });
      },      replacePolygonImage: (base64Image: string) => {
        console.log('=== Замена изображения полигона ===');
        console.log('Длина base64 изображения:', base64Image?.length || 'undefined');
        
        if (!mapInstanceRef.current || !vectorSourceRef.current) {
          console.error('Карта или векторный источник недоступны');
          return;
        }

        const features = vectorSourceRef.current.getFeatures();
        console.log('Найдено объектов на карте:', features.length);
        
        if (features.length === 0) {
          console.error('На карте нет полигонов');
          return;
        }

        // Берем последний нарисованный полигон
        const lastFeature = features[features.length - 1];
        const geometry = lastFeature.getGeometry();        if (!geometry || !(geometry instanceof Polygon || geometry instanceof MultiPolygon)) {
          console.error('Последний объект не является полигоном или мультиполигоном');
          return;
        }

        // Очистить существующий слой изображения
        console.log('Очищаем существующий слой изображения...');
        clearImageLayer();

        // Получаем экстент полигона
        const polygonExtent = geometry.getExtent();
        console.log('Экстент полигона для замены:', polygonExtent);        try {
          // Создаем data URL из base64, проверяя на дублирование префикса
          let imageUrl: string;
          if (base64Image.startsWith('data:image/')) {
            // Данные уже содержат data URL
            imageUrl = base64Image;
            console.log('Base64 уже содержит data URL префикс');
          } else {
            // Добавляем префикс к чистому base64
            imageUrl = `data:image/png;base64,${base64Image}`;
            console.log('Добавлен data URL префикс к base64');
          }
          console.log('Создан data URL для изображения');

          // Получаем проекцию карты
          const mapProjection = mapInstanceRef.current.getView().getProjection().getCode();
          console.log('Проекция карты:', mapProjection);

          // Создаем изображение для определения его размеров
          const img = new Image();
          img.onload = () => {
            console.log('Размеры загруженного изображения:', img.width, 'x', img.height);
            
            // Вычисляем соотношение сторон
            const imageAspectRatio = img.width / img.height;
            const polygonWidth = polygonExtent[2] - polygonExtent[0];
            const polygonHeight = polygonExtent[3] - polygonExtent[1];
            const polygonAspectRatio = polygonWidth / polygonHeight;
            
            console.log('Соотношение сторон - изображение:', imageAspectRatio, 'полигон:', polygonAspectRatio);
            
            // Используем экстент полигона точно как есть
            // Это сохранит изображение в той же области, что и был полигон
            const finalExtent = polygonExtent;
            
            console.log('Итоговый экстент для изображения:', finalExtent);

            // Создать новый слой изображения с точным экстентом полигона
            const imageLayer = new ImageLayer({
              source: new Static({
                url: imageUrl,
                imageExtent: finalExtent,
                projection: mapProjection,
              }),
              opacity: 1.0,
              zIndex: 50
            });

            console.log('Создан новый слой изображения с сохраненным размером');

            // Добавляем слой изображения
            mapInstanceRef.current?.addLayer(imageLayer);
            imageLayerRef.current = imageLayer;

            console.log('=== Замена изображения полигона завершена успешно ===');
          };
          
          img.onerror = (error) => {
            console.error('Ошибка загрузки изображения:', error);
            
            // Fallback: используем оригинальный метод
            const imageLayer = new ImageLayer({
              source: new Static({
                url: imageUrl,
                imageExtent: polygonExtent,
                projection: mapProjection,
              }),
              opacity: 1.0,
              zIndex: 50
            });

            mapInstanceRef.current?.addLayer(imageLayer);
            imageLayerRef.current = imageLayer;
            
            console.log('=== Замена изображения завершена с fallback методом ===');
          };
            img.src = imageUrl;        } catch (error) {
          console.error('=== Ошибка при замене изображения полигона ===');
          console.error('Error details:', error);
        }
      },      navigateToPolygon: (index: number) => {
        if (!mapInstanceRef.current || !vectorSourceRef.current) return;

        // Используем полигоны из vectorSource для навигации
        const features = vectorSourceRef.current.getFeatures();
        if (index < 0 || index >= features.length) {
          console.error('Invalid polygon index:', index);
          return;
        }        const feature = features[index];
        const geometry = feature.getGeometry();
        
        if (geometry instanceof Polygon || geometry instanceof MultiPolygon) {
          const extent = geometry.getExtent();
          const view = mapInstanceRef.current.getView();

          view.fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 16,
            duration: 1000
          });
          
          console.log(`Navigated to ${geometry instanceof MultiPolygon ? 'MultiPolygon' : 'Polygon'} ${index}`);
        }      },
      navigateToPolygonPart: (polygonIndex: number, partIndex: number) => {
        if (!mapInstanceRef.current || !vectorSourceRef.current) return;

        // Используем полигоны из vectorSource для навигации
        const features = vectorSourceRef.current.getFeatures();
        if (polygonIndex < 0 || polygonIndex >= features.length) {
          console.error('Invalid polygon index:', polygonIndex);
          return;
        }

        const feature = features[polygonIndex];
        const geometry = feature.getGeometry();
        
        if (geometry instanceof MultiPolygon) {
          const polygons = geometry.getPolygons();
          if (partIndex < 0 || partIndex >= polygons.length) {
            console.error('Invalid part index:', partIndex);
            return;
          }

          const partPolygon = polygons[partIndex];
          const extent = partPolygon.getExtent();
          const view = mapInstanceRef.current.getView();

          view.fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 16,
            duration: 1000
          });
          
          console.log(`Navigated to part ${partIndex} of MultiPolygon ${polygonIndex}`);
        } else {
          // Fallback к обычной навигации если это не MultiPolygon
          console.log('Feature is not a MultiPolygon, falling back to regular navigation');
          const extent = geometry?.getExtent();
          if (extent) {
            const view = mapInstanceRef.current.getView();
            view.fit(extent, {
              padding: [50, 50, 50, 50],
              maxZoom: 16,
              duration: 1000
            });
          }
        }
      },
      getLoadedPolygons: () => {
        if (!loadedPolygonsRef.current) return [];

        const format = new GeoJSON();
        return loadedPolygonsRef.current.map(feature => 
          format.writeFeatureObject(feature, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          })
        );
      },
      removePolygonByIndex: (index: number) => {
        if (!vectorSourceRef.current) return;
        const features = vectorSourceRef.current.getFeatures();
        if (index < 0 || index >= features.length) return;
        vectorSourceRef.current.removeFeature(features[index]);
      },
      setPolygonVisibilityByIndex: (index: number, visible: boolean) => {
        if (!vectorSourceRef.current) return;
        const features = vectorSourceRef.current.getFeatures();
        if (index < 0 || index >= features.length) return;
        const feature = features[index];
        feature.set('visible', visible); // store visibility in feature property
        if (visible) {
          feature.setStyle(createVectorStyle()(feature));
        } else {
          feature.setStyle(() => undefined); // hide
        }
      },      setPolygonHoverByIndex: (index: number, hovered: boolean) => {
        if (!vectorSourceRef.current) return;
        const features = vectorSourceRef.current.getFeatures();
        if (index < 0 || index >= features.length) return;
        const feature = features[index];
        const visible = feature.get('visible');
        if (hovered) {
          feature.setStyle(createHoverStyle()(feature));
        } else {
          if (typeof visible === 'boolean' && visible === false) {
            feature.setStyle(() => undefined);
          } else {
            feature.setStyle(createVectorStyle()(feature));
          }
        }
      },      addGeoJSONFeature: (geoJSON: any) => {
        console.log('Adding GeoJSON feature to map:', geoJSON);
        
        if (!vectorSourceRef.current || !mapInstanceRef.current) {
          console.error('Vector source or map instance not available');
          return;
        }

        try {
          const format = new GeoJSON();
          const feature = format.readFeature(geoJSON, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });

          // Проверяем, что feature это одиночная фича, а не массив
          if (Array.isArray(feature)) {
            console.error('Expected single feature, got array');
            return;
          }          // Упрощаем геометрию, если это полигон или мультиполигон через turf.simplify (Visvalingam-Whyatt)
          const geometry = feature.getGeometry();
          if (geometry && (geometry instanceof Polygon || geometry instanceof MultiPolygon)) {
            // Переводим в GeoJSON
            const geojsonGeom = format.writeGeometryObject(geometry, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857',
            });
            // Более деликатное упрощение: tolerance ~5м, highQuality по умолчанию (false)
            const simplifiedGeojson = simplify(geojsonGeom, { tolerance: 0.01, highQuality: false });
            // Обратно в OpenLayers Polygon
            const simplified = format.readGeometry(simplifiedGeojson, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857',
            });
            feature.setGeometry(simplified);
          } else if (geometry && geometry instanceof MultiPolygon) {
            console.log('Processing MultiPolygon geometry for simplification');
            // Переводим в GeoJSON
            const geojsonGeom = format.writeGeometryObject(geometry, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857',
            });
            // Упрощаем MultiPolygon
           
            const simplifiedGeojson = simplify(geojsonGeom, { tolerance: 0.01, highQuality: false });
            // Обратно в OpenLayers MultiPolygon
            const simplified = format.readGeometry(simplifiedGeojson, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857',
            });
            feature.setGeometry(simplified);
          }

          // Устанавливаем стиль для фичи
          feature.setStyle(createVectorStyle());
          
          // Добавляем фичу в векторный источник
          vectorSourceRef.current.addFeature(feature);
          
          console.log('GeoJSON feature successfully added to map');
          
          // Обновляем количество фич
          if (onFeatureCountChange) {
            onFeatureCountChange(vectorSourceRef.current.getFeatures().length);
          }
          
          // Обновляем центр полигона
          schedulePolygonCenterUpdate();
            } catch (error) {
          console.error('Error adding GeoJSON feature:', error);
        }
      },
      
      // Методы для работы с частями MultiPolygon
      setPolygonPartVisibilityByIndex: (polygonIndex: number, partIndex: number, visible: boolean) => {
        if (!vectorSourceRef.current) return;
        const features = vectorSourceRef.current.getFeatures();
        if (polygonIndex < 0 || polygonIndex >= features.length) return;
        
        const feature = features[polygonIndex];
        const geometry = feature.getGeometry();
        
        if (geometry instanceof MultiPolygon) {
          // Для MultiPolygon храним видимость частей в свойствах фичи
          const partVisibilityKey = `part_${partIndex}_visible`;
          feature.set(partVisibilityKey, visible);
          
          // Пересоздаем стиль с учетом видимости частей
          const customStyle = createVectorStyle();
          feature.setStyle(customStyle);
          
          console.log(`Set part ${partIndex} of polygon ${polygonIndex} visibility to ${visible}`);
        }
      },
        setPolygonPartHoverByIndex: (polygonIndex: number, partIndex: number, hovered: boolean) => {
        if (!vectorSourceRef.current) return;
        const features = vectorSourceRef.current.getFeatures();
        if (polygonIndex < 0 || polygonIndex >= features.length) return;
        
        const feature = features[polygonIndex];
        const geometry = feature.getGeometry();
        
        if (geometry instanceof MultiPolygon) {
          if (hovered) {
            // Создаем специальный стиль для выделения конкретной части
            const polygons = geometry.getPolygons();
            if (partIndex >= 0 && partIndex < polygons.length) {
              const styles: Style[] = [];
              
              // Добавляем обычные стили для всех частей
              polygons.forEach((polygon, index) => {
                // Проверяем видимость конкретной части
                const partVisibilityKey = `part_${index}_visible`;
                const isPartVisible = feature.get(partVisibilityKey);
                
                // Если видимость части явно установлена в false, пропускаем её
                if (isPartVisible === false) {
                  return;
                }
                
                if (index === partIndex) {
                  // Выделяем конкретную часть
                  styles.push(
                    new Style({
                      geometry: polygon,
                      stroke: new Stroke({
                        color: theme.palette.mode === 'dark' ? '#00E5C5' : theme.palette.primary.main,
                        width: 4,
                      }),
                      fill: new Fill({
                        color: 'rgba(0,229,197,0.15)', // более заметная подсветка для выбранной части
                      }),
                    })
                  );
                } else {
                  // Обычный стиль для остальных частей
                  styles.push(
                    new Style({
                      geometry: polygon,
                      stroke: new Stroke({
                        color: '#00b3b3',
                        width: 2,
                      }),
                    })
                  );
                }
              });
              
              feature.setStyle(styles);
            }
          } else {
            // Возвращаем обычный стиль
            const visible = feature.get('visible');
            if (typeof visible === 'boolean' && visible === false) {
              feature.setStyle(() => undefined);
            } else {
              feature.setStyle(createVectorStyle()(feature));
            }
          }
          
          console.log(`Set part ${partIndex} of polygon ${polygonIndex} hover to ${hovered}`);
        }
      },
        removePolygonPartByIndex: (polygonIndex: number, partIndex: number) => {
        if (!vectorSourceRef.current) return;
        const features = vectorSourceRef.current.getFeatures();
        if (polygonIndex < 0 || polygonIndex >= features.length) return;
        
        const feature = features[polygonIndex];
        const geometry = feature.getGeometry();
        
        if (geometry instanceof MultiPolygon) {
          const polygons = geometry.getPolygons();
          if (partIndex < 0 || partIndex >= polygons.length) return;
          
          // Создаем новый MultiPolygon без удаляемой части
          const remainingPolygons = polygons.filter((_, idx) => idx !== partIndex);
          
          if (remainingPolygons.length === 0) {
            // Если не осталось частей, удаляем весь полигон
            vectorSourceRef.current.removeFeature(feature);
          } else if (remainingPolygons.length === 1) {
            // Если осталась одна часть, конвертируем в обычный Polygon
            feature.setGeometry(remainingPolygons[0]);
            
            // Очищаем все свойства видимости частей, так как теперь это обычный Polygon
            const properties = feature.getProperties();
            Object.keys(properties).forEach(key => {
              if (key.startsWith('part_') && key.endsWith('_visible')) {
                feature.unset(key);
              }
            });
          } else {
            // Создаем новый MultiPolygon из оставшихся частей
            const newMultiPolygon = new MultiPolygon(remainingPolygons.map(p => p.getCoordinates()));
            feature.setGeometry(newMultiPolygon);
            
            // Обновляем индексы видимости частей
            const properties = feature.getProperties();
            const oldPartVisibility: { [key: number]: boolean } = {};
            
            // Сохраняем старые настройки видимости
            Object.keys(properties).forEach(key => {
              if (key.startsWith('part_') && key.endsWith('_visible')) {
                const index = parseInt(key.replace('part_', '').replace('_visible', ''));
                if (!isNaN(index)) {
                  oldPartVisibility[index] = properties[key];
                }
                feature.unset(key);
              }
            });
            
            // Перемапим видимость с учетом удаленной части
            Object.keys(oldPartVisibility).forEach(oldIndexStr => {
              const oldIndex = parseInt(oldIndexStr);
              if (oldIndex > partIndex) {
                // Части после удаленной сдвигаются на один индекс назад
                const newIndex = oldIndex - 1;
                feature.set(`part_${newIndex}_visible`, oldPartVisibility[oldIndex]);
              } else if (oldIndex < partIndex) {
                // Части до удаленной остаются с теми же индексами
                feature.set(`part_${oldIndex}_visible`, oldPartVisibility[oldIndex]);
              }
              // Удаленная часть (oldIndex === partIndex) не копируется
            });
          }
          
          // Обновляем количество фич
          if (onFeatureCountChange) {
            onFeatureCountChange(vectorSourceRef.current.getFeatures().length);
          }
          
          console.log(`Removed part ${partIndex} from polygon ${polygonIndex}`);
        }
      },
    }),
    [showTemporaryRectangle, clearTemporaryRectangle, clearImageLayer, worldFileToExtent],
  );

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      clearTemporaryRectangle();
      clearImageLayer();
    };
  }, [clearTemporaryRectangle, clearImageLayer]);

  // Обновление размера карты
  useEffect(() => {
    const updateMapSize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.updateSize();
      }
    };

    const resizeObserver = new ResizeObserver(updateMapSize);
    if (mapRef.current) {
      resizeObserver.observe(mapRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <Box
      ref={mapRef}
      sx={{
        width: '100%',
        height: '100%',
        '& .ol-zoom': {
          top: 'auto',
          left: 'auto',
          bottom: '1rem',
          right: '1rem',
        },
        '& .ol-attribution': {
          background: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
        },
      }}
    />
  );
});

OpenLayersMap.displayName = 'OpenLayersMap';
export default React.memo(OpenLayersMap);
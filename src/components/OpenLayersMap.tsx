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
import Point from 'ol/geom/Point';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import { getArea } from 'ol/sphere';
import { Overlay } from 'ol';
import Feature from 'ol/Feature';
import { Coordinate } from 'ol/coordinate';

// Тип для ref
export interface OpenLayersMapHandle {
  loadGeoJSON: (geoJSON: any) => void;
  clearAllFeatures: () => void;
  disableDrawingMode: () => void;
  showTemporaryRectangle: () => void;
  clearTemporaryRectangle: () => void;
  exportFeatures: () => any[];
  displayGeoReferencedImage: (imageData: string, worldFile: any) => void;
  togglePolygonsVisibility: () => void;
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
    }>({});
    const currentZoomRef = useRef<number>(initialZoom);
    const currentCenterRef = useRef<[number, number]>(initialCenter);
    const theme = useTheme();
    const temporaryFeatureRef = useRef<Feature | null>(null);
    const overlayRef = useRef<Overlay | null>(null);
    const temporaryDivRef = useRef<HTMLDivElement | null>(null);
    const imageLayerRef = useRef<ImageLayer<Static> | null>(null);    // Function to clear existing image layer
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
    }, []);

    // Function to calculate polygon center and convert to screen coordinates
    const calculatePolygonCenterInPixels = useCallback(() => {
      if (!mapInstanceRef.current || !vectorSourceRef.current) return null;

      const features = vectorSourceRef.current.getFeatures();
      if (features.length === 0) return null;

      // Get the last added polygon
      const lastFeature = features[features.length - 1];
      const geometry = lastFeature.getGeometry();

      if (!geometry || !(geometry instanceof Polygon)) return null;

      // Calculate the center of the polygon extent
      const extent = geometry.getExtent();
      const centerX = (extent[0] + extent[2]) / 2;
      const centerY = (extent[1] + extent[3]) / 2;

      // Convert map coordinates to screen pixels
      const pixel = mapInstanceRef.current.getPixelFromCoordinate([centerX, centerY]);
      if (!pixel) return null;

      return [pixel[0], pixel[1]] as [number, number];
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
    };

    // Создание базовых слоев карты
    const createBaseLayer = (layerType: string): TileLayer => {
      switch (layerType) {
        case 'BingAerial':
          return new TileLayer({
            source: new BingMaps({
              key: 'AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L',
              imagerySet: 'Aerial',
            }),
          });
        case 'YandexSatellite':
          return new TileLayer({
            source: new XYZ({
              url: 'https://sat01.maps.yandex.net/tiles?l=sat&v=3.1025.0&x={x}&y={y}&z={z}&scale=1&lang=ru_RU',
              attributions: '© Яндекс.Карты'
            }),
          });
        case 'GoogleSatellite':
          return new TileLayer({
            source: new XYZ({
              url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
              attributions: '© Google'
            }),
          });
        case 'ESRISatellite':
          return new TileLayer({
            source: new XYZ({
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              attributions: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
            }),
          });
        case 'ESRIStreet':
          return new TileLayer({
            source: new XYZ({
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
              attributions: '© Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
            }),
          });
        case 'OSM':
        default:
          return new TileLayer({
            source: new OSM(),
          });
      }
    };

    // Создание overlay слоев
    const createOverlayLayers = (layerType: string) => {
      const layers: { [key: string]: TileLayer } = {};

      layers.borders = new TileLayer({
        source: new XYZ({
          url: 'https://tiles.wmflabs.org/osm-intl/{z}/{x}/{y}.png',
          attributions: '© OpenStreetMap contributors'
        }),
        opacity: 0.7,
        visible: false
      });

      layers.contour = new TileLayer({
        source: new XYZ({
          url: 'https://maps.refuges.info/hiking/{z}/{x}/{y}.png',
          attributions: '© refuges.info'
        }),
        opacity: 0.6,
        visible: false
      });

      layers.labels = new TileLayer({
        source: new XYZ({
          url: 'https://stamen-tiles-{a-d}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png',
          attributions: '© Stamen Design'
        }),
        opacity: 1.0,
        visible: true
      });

      const createRoadLayer = () => {
        switch (layerType) {
          case 'BingAerial':
            return new TileLayer({
              source: new XYZ({
                url: 'https://ecn.t0.tiles.virtualearth.net/tiles/h{quadkey}.jpeg?g=1',
                attributions: '© Microsoft Bing Maps'
              }),
              opacity: 0.8,
              visible: false
            });
          case 'YandexSatellite':
            return new TileLayer({
              source: new XYZ({
                url: 'https://vec01.maps.yandex.net/tiles?l=skl&v=20.06.03-0&x={x}&y={y}&z={z}&scale=1&lang=ru_RU',
                attributions: '© Яндекс.Карты'
              }),
              opacity: 0.8,
              visible: false
            });
          case 'GoogleSatellite':
            return new TileLayer({
              source: new XYZ({
                url: 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
                attributions: '© Google'
              }),
              opacity: 0.8,
              visible: false
            });
          case 'ESRISatellite':
            return new TileLayer({
              source: new XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
              attributions: '© Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, © OpenStreetMap contributors, and the GIS User Community'
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
              attributions: ''
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
      const geometry = feature.getGeometry();

      if (geometry instanceof Polygon) {
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
        );
      }

      return styles;
    };
  };

  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createVectorStyle(),
      zIndex: 100 // Высокий zIndex для векторного слоя, чтобы он был поверх всех остальных
    });

    vectorSourceRef.current = vectorSource;
    vectorLayerRef.current = vectorLayer;

    const baseLayer = createBaseLayer(currentLayer);
    baseLayerRef.current = baseLayer;

    const overlayLayers = createOverlayLayers(currentLayer);
    overlayLayersRef.current = overlayLayers;

    const attribution = new Attribution({
      collapsible: false,
    });

    const map = new Map({
      target: mapRef.current,
      layers: [
        baseLayer,
        ...Object.values(overlayLayers),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat(initialCenter),
        zoom: initialZoom,
      }),
      controls: defaultControls({ attribution: false }).extend([attribution]),
    });    vectorSource.on('addfeature', () => {
      if (onFeatureCountChange) {
        onFeatureCountChange(vectorSource.getFeatures().length);
      }
      
      // Update polygon center for progress overlay positioning
      if (onPolygonCenterChange) {
        const polygonCenter = calculatePolygonCenterInPixels();
        onPolygonCenterChange(polygonCenter);
      }
    });

    vectorSource.on('removefeature', () => {
      if (onFeatureCountChange) {
        onFeatureCountChange(vectorSource.getFeatures().length);
      }
      
      // Update polygon center for progress overlay positioning
      if (onPolygonCenterChange) {
        const polygonCenter = calculatePolygonCenterInPixels();
        onPolygonCenterChange(polygonCenter);
      }
      
      // Удаляем изображение при удалении полигона
      clearImageLayer();
    });

    mapInstanceRef.current = map;    map.getView().on('change:center', () => {
      currentCenterRef.current = toLonLat(map.getView().getCenter() as [number, number]) as [number, number];
      
      // Update polygon center when map view changes
      if (onPolygonCenterChange) {
        const polygonCenter = calculatePolygonCenterInPixels();
        onPolygonCenterChange(polygonCenter);
      }
    });

    map.getView().on('change:resolution', () => {
      currentZoomRef.current = map.getView().getZoom() || initialZoom;
      
      // Update polygon center when map view changes
      if (onPolygonCenterChange) {
        const polygonCenter = calculatePolygonCenterInPixels();
        onPolygonCenterChange(polygonCenter);
      }
    });return () => {
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

      // Добавляем метку с площадью
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
      loadGeoJSON: (geoJSON: any) => {
        if (!vectorSourceRef.current || !mapInstanceRef.current) return;

        const format = new GeoJSON();
        const features = format.readFeatures(geoJSON, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });

        features.forEach((feature) => {
          feature.setStyle(createVectorStyle());
        });

        vectorSourceRef.current.addFeatures(features);

        if (features.length > 0) {
          const extent = vectorSourceRef.current.getExtent();
          const view = mapInstanceRef.current.getView();

          view.fit(extent, {
            padding: [20, 20, 20, 20],
            maxZoom: 16,
          });
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
      },
      clearAllFeatures: () => {
        if (vectorSourceRef.current) {
          vectorSourceRef.current.clear();
        }
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
        const geometry = lastFeature.getGeometry();

        if (!geometry || !(geometry instanceof Polygon)) {
          console.error('Last feature is not a polygon');
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
          
          // Дополнительная проверка видимости слоя
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
      },
      togglePolygonsVisibility: () => {
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
      }
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
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import BingMaps from 'ol/source/BingMaps';
import { fromLonLat } from 'ol/proj';
import { Box, useTheme } from '@mui/material';
import { Attribution, defaults as defaultControls } from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw, Modify, Snap } from 'ol/interaction';
import Polygon from 'ol/geom/Polygon';
import Point from 'ol/geom/Point';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';

// Тип для ref
export interface OpenLayersMapHandle {
  loadGeoJSON: (geoJSON: any) => void;
  clearAllFeatures: () => void; // New method to clear all features
  disableDrawingMode: () => void; // New method to disable drawing mode programmatically
}

interface OpenLayersMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  center?: [number, number];
  zoom?: number;
  drawingTool?: 'polygon' | 'rectangle' | null;
  onFeatureAdded?: (feature: any) => void;
  onFeatureCountChange?: (count: number) => void; // New prop to report feature count
  currentLayer?: string; // Add currentLayer prop
  overlaySettings?: {
    borders: boolean;
    contour: boolean;
    labels: boolean;
    roads: boolean;
  };
}

// Используем forwardRef для передачи ref от родительского компонента
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
      currentLayer = 'OSM', // Default to OSM
      overlaySettings = {
        borders: false,
        contour: false,
        labels: true,
        roads: false
      },
    },
    ref,
  ) => {    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<Map | null>(null);
    const vectorSourceRef = useRef<VectorSource | null>(null);
    const vectorLayerRef = useRef<VectorLayer | null>(null);
    const drawInteractionRef = useRef<Draw | null>(null);
    const snapInteractionRef = useRef<Snap | null>(null);
    const baseLayerRef = useRef<TileLayer | null>(null); // Add ref for base layer
    const overlayLayersRef = useRef<{
      borders?: TileLayer;
      contour?: TileLayer;
      labels?: TileLayer;
      roads?: TileLayer;
    }>({});
    const currentZoomRef = useRef<number>(initialZoom); // Ref to store current zoom level
    const currentCenterRef = useRef<[number, number]>(initialCenter); // Ref to store current center
    const theme = useTheme();

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
      switch (layerType) {
        case 'BingAerial':
          return new TileLayer({
            source: new BingMaps({
              key: 'AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L', // Используем публичный ключ для демо
              imagerySet: 'Aerial', // Спутниковые снимки
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
    };// Создание overlay слоев
    const createOverlayLayers = (layerType: string) => {
      const layers: { [key: string]: TileLayer } = {};

      // Слой границ (используем OpenStreetMap с фильтром для границ)
      layers.borders = new TileLayer({
        source: new XYZ({
          url: 'https://tiles.wmflabs.org/osm-intl/{z}/{x}/{y}.png',
          attributions: '© OpenStreetMap contributors'
        }),
        opacity: 0.7,
        visible: false
      });

      // Слой контуров (используем SRTM данные)
      layers.contour = new TileLayer({
        source: new XYZ({
          url: 'https://maps.refuges.info/hiking/{z}/{x}/{y}.png',
          attributions: '© refuges.info'
        }),
        opacity: 0.6,
        visible: false
      });

      // Слой подписей (OpenStreetMap labels)
      layers.labels = new TileLayer({
        source: new XYZ({
          url: 'https://stamen-tiles-{a-d}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png',
          attributions: '© Stamen Design'
        }),
        opacity: 1.0,
        visible: true // По умолчанию включен
      });      // Слой дорог - разные источники в зависимости от базового слоя
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
            // Для OSM и ESRIStreet слой дорог не нужен, так как они уже встроены
            return new TileLayer({
              source: new XYZ({
                url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', // Прозрачный пиксель
                attributions: ''
              }),
              opacity: 0,
              visible: false
            });
        }
      };

      layers.roads = createRoadLayer();

      return layers;
    };// Стиль для отображения фигур с белыми точками на углах
    const createVectorStyle = () => {
      const styles = [
        // Основной стиль для фигуры
        new Style({
          fill: new Fill({
            color: 'rgba(0, 179, 179, 0.2)',
          }),
          stroke: new Stroke({
            color: '#00b3b3',
            width: 2,
          }),
        }),
      ];

      return (feature: any) => {
        const geometry = feature.getGeometry();
        
        // Добавляем белые точки на углах
        if (geometry instanceof Polygon) {
          const coordinates = geometry.getCoordinates()[0]; // Получаем координаты внешнего кольца
          coordinates.slice(0, -1).forEach((coord: any) => { // Исключаем последнюю точку (дубликат первой)
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
        }
        
        return styles;
      };
    };    // Инициализация карты
    useEffect(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const vectorSource = new VectorSource();
      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: createVectorStyle(),
      });

      vectorSourceRef.current = vectorSource;
      vectorLayerRef.current = vectorLayer;

      // Создаем базовый слой
      const baseLayer = createBaseLayer(currentLayer);
      baseLayerRef.current = baseLayer;      // Создаем overlay слои
      const overlayLayers = createOverlayLayers(currentLayer);
      overlayLayersRef.current = overlayLayers;

      const attribution = new Attribution({
        collapsible: false,
      });      const map = new Map({
        target: mapRef.current,
        layers: [
          baseLayer, // Используем созданный базовый слой
          ...Object.values(overlayLayers), // Добавляем overlay слои
          vectorLayer, // Векторный слой должен быть сверху
        ],
        view: new View({
          center: fromLonLat(initialCenter),
          zoom: initialZoom,
        }),
        controls: defaultControls({ attribution: false }).extend([attribution]),
      });

      // Отключаем modify interaction для предотвращения редактирования полигонов
      // const modify = new Modify({
      //   source: vectorSource,
      //   style: new Style({
      //     image: new CircleStyle({
      //       radius: 6,
      //       fill: new Fill({
      //         color: '#ffcc33',
      //       }),
      //       stroke: new Stroke({
      //         color: '#ffffff',
      //         width: 2,
      //       }),
      //     }),
      //   }),
      // });
      // map.addInteraction(modify);

      // Track feature count changes
      vectorSource.on('addfeature', () => {
        if (onFeatureCountChange) {
          onFeatureCountChange(vectorSource.getFeatures().length);
        }
      });
      vectorSource.on('removefeature', () => {
        if (onFeatureCountChange) {
          onFeatureCountChange(vectorSource.getFeatures().length);
        }
      });      mapInstanceRef.current = map;

      // Добавляем слушатель изменений вида карты для сохранения текущего зума и центра
      map.getView().on('change:center', () => {
        currentCenterRef.current = map.getView().getCenter() as [number, number];
      });
      
      map.getView().on('change:resolution', () => {
        currentZoomRef.current = map.getView().getZoom() || initialZoom;
      });

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setTarget(undefined);
          mapInstanceRef.current = null;        }
      };
    }, [onFeatureCountChange, currentLayer]); // Add currentLayer dependency    // Обновление базового слоя при изменении currentLayer
    useEffect(() => {
      if (mapInstanceRef.current && baseLayerRef.current) {
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
        
        // Создаем новые overlay слои с учетом нового базового слоя
        const newOverlayLayers = createOverlayLayers(currentLayer);
        overlayLayersRef.current = newOverlayLayers;
        
        // Добавляем новый базовый слой на позицию 0 (внизу)
        mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
        
        // Добавляем новые overlay слои
        const layers = mapInstanceRef.current.getLayers();
        const vectorLayerIndex = layers.getLength() - 1; // Векторный слой должен быть последним
        Object.values(newOverlayLayers).forEach((layer, index) => {
          layers.insertAt(vectorLayerIndex + index, layer);
        });
        
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

      mapRef.current.style.cursor = 'crosshair';      // Стиль для рисования с белыми точками на углах
      const drawingStyle = (feature: any) => {
        const styles = [
          // Основной стиль для фигуры во время рисования
          new Style({
            fill: new Fill({
              color: 'rgba(0, 179, 179, 0.2)',
            }),
            stroke: new Stroke({
              color: '#00b3b3',
              width: 2,
              lineDash: drawingTool === 'polygon' ? [5, 5] : undefined,
            }),
          }),
        ];

        const geometry = feature.getGeometry();
        
        // Добавляем белые точки на углах во время рисования
        if (geometry instanceof Polygon) {
          const coordinates = geometry.getCoordinates()[0];
          coordinates.slice(0, -1).forEach((coord: any) => {
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
        }
        
        return styles;
      };const geometryType = drawingTool === 'polygon' ? 'Polygon' : 'Circle';
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
        freehand: false, // Изменено на false для рисования кликами
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
      mapInstanceRef.current.addInteraction(snap);      drawInteractionRef.current = draw;
      snapInteractionRef.current = snap;    }, [drawingTool, onFeatureAdded]);

    // Обновление видимости overlay слоев при изменении настроек
    useEffect(() => {
      updateOverlayVisibility();
    }, [overlaySettings]);    // Экспонируем функции через ref
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

          vectorSourceRef.current.addFeatures(features);          // Автоматический переход к загруженным объектам
          if (features.length > 0) {
            const extent = vectorSourceRef.current.getExtent();
            const view = mapInstanceRef.current.getView();
            
            // Устанавливаем вид с отступами для лучшего отображения
            view.fit(extent, {
              padding: [20, 20, 20, 20],
              maxZoom: 16, // Максимальный зум для предотвращения чрезмерного приближения
            });
          }
        },
        clearAllFeatures: () => {
          if (vectorSourceRef.current) {
            vectorSourceRef.current.clear();
          }
        },
        disableDrawingMode: () => {
          if (!mapInstanceRef.current || !mapRef.current) return;
          
          // Удаляем интерактивные элементы рисования
          if (drawInteractionRef.current) {
            mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
          }
          if (snapInteractionRef.current) {
            mapInstanceRef.current.removeInteraction(snapInteractionRef.current);
            snapInteractionRef.current = null;
          }
          
          // Сбрасываем курсор
          mapRef.current.style.cursor = '';
        },
      }),
      [],
    );

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
  },
);

OpenLayersMap.displayName = 'OpenLayersMap';
export default React.memo(OpenLayersMap);
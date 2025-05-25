import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import BingMaps from 'ol/source/BingMaps';
import { fromLonLat, toLonLat } from 'ol/proj';
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
  clearAllFeatures: () => void;
  disableDrawingMode: () => void;
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

    // Стиль для отображения фигур с белыми точками на углах
    const createVectorStyle = () => {
      const styles = [
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
      };
    };

    // Инициализация карты
    useEffect(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const vectorSource = new VectorSource();
      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: createVectorStyle(),
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
      });

      vectorSource.on('addfeature', () => {
        if (onFeatureCountChange) {
          onFeatureCountChange(vectorSource.getFeatures().length);
        }
      });
      vectorSource.on('removefeature', () => {
        if (onFeatureCountChange) {
          onFeatureCountChange(vectorSource.getFeatures().length);
        }
      });

      mapInstanceRef.current = map;

      map.getView().on('change:center', () => {
        currentCenterRef.current = toLonLat(map.getView().getCenter() as [number, number]) as [number, number];
      });
      
      map.getView().on('change:resolution', () => {
        currentZoomRef.current = map.getView().getZoom() || initialZoom;
      });

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setTarget(undefined);
          mapInstanceRef.current = null;
        }
      };
    }, [onFeatureCountChange, currentLayer]);

    // Обновление базового слоя при изменении currentLayer
    useEffect(() => {
      if (mapInstanceRef.current && baseLayerRef.current) {
        // Сохраняем текущий центр и зум перед обновлением слоев
        const currentCenter = currentCenterRef.current;
        const currentZoom = currentZoomRef.current;

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
        
        // Добавляем новый базовый слой на позицию 0
        mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
        
        // Добавляем новые overlay слои
        const layers = mapInstanceRef.current.getLayers();
        const vectorLayerIndex = layers.getLength() - 1;
        Object.values(newOverlayLayers).forEach((layer, index) => {
          layers.insertAt(vectorLayerIndex + index, layer);
        });
        
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
        const styles = [
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
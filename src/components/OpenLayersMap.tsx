import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { Box, useTheme } from '@mui/material';
import { Attribution, defaults as defaultControls } from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw, Modify, Snap } from 'ol/interaction';
import Polygon from 'ol/geom/Polygon';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';

// Тип для ref
export interface OpenLayersMapHandle {
  loadGeoJSON: (geoJSON: any) => void;
  clearAllFeatures: () => void; // New method to clear all features
}

interface OpenLayersMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  center?: [number, number];
  zoom?: number;
  drawingTool?: 'polygon' | 'rectangle' | null;
  onFeatureAdded?: (feature: any) => void;
  onFeatureCountChange?: (count: number) => void; // New prop to report feature count
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
    },
    ref,
  ) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<Map | null>(null);
    const vectorSourceRef = useRef<VectorSource | null>(null);
    const vectorLayerRef = useRef<VectorLayer | null>(null);
    const drawInteractionRef = useRef<Draw | null>(null);
    const snapInteractionRef = useRef<Snap | null>(null);
    const theme = useTheme();

    // Стиль для отображения фигур (всегда показываем вершины)
    const createVectorStyle = () =>
      new Style({
        fill: new Fill({
          color: 'rgba(0, 179, 179, 0.2)',
        }),
        stroke: new Stroke({
          color: '#00b3b3',
          width: 2,
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: '#00b3b3',
          }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 1,
          }),
        }),
        geometry: function (feature) {
          const geometry = feature.getGeometry();
          if (geometry instanceof Polygon) {
            return geometry; // Always show vertices for polygons
          }
          return geometry;
        },
      });

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

      const attribution = new Attribution({
        collapsible: false,
      });

      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          vectorLayer,
        ],
        view: new View({
          center: fromLonLat(initialCenter),
          zoom: initialZoom,
        }),
        controls: defaultControls({ attribution: false }).extend([attribution]),
      });

      const modify = new Modify({
        source: vectorSource,
        style: new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({
              color: '#ffcc33',
            }),
            stroke: new Stroke({
              color: '#ffffff',
              width: 2,
            }),
          }),
        }),
      });
      map.addInteraction(modify);

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
      });

      mapInstanceRef.current = map;

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setTarget(undefined);
          mapInstanceRef.current = null;
        }
      };
    }, [onFeatureCountChange]);

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

      // Стиль для рисования (всегда показываем вершины)
      const drawingStyle = new Style({
        fill: new Fill({
          color: 'rgba(0, 179, 179, 0.2)',
        }),
        stroke: new Stroke({
          color: '#00b3b3',
          width: 2,
          lineDash: drawingTool === 'polygon' ? [5, 5] : undefined,
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: '#00b3b3',
          }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 1,
          }),
        }),
        geometry: function (feature) {
          const geometry = feature.getGeometry();
          if (geometry instanceof Polygon) {
            return geometry; // Always show vertices during drawing
          }
          return geometry;
        },
      });

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
        freehand: drawingTool === 'rectangle',
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

    // Экспонируем функции через ref
    useImperativeHandle(
      ref,
      () => ({
        loadGeoJSON: (geoJSON: any) => {
          if (!vectorSourceRef.current) return;

          const format = new GeoJSON();
          const features = format.readFeatures(geoJSON, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });

          features.forEach((feature) => {
            feature.setStyle(createVectorStyle());
          });

          vectorSourceRef.current.addFeatures(features);
        },
        clearAllFeatures: () => {
          if (vectorSourceRef.current) {
            vectorSourceRef.current.clear();
          }
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
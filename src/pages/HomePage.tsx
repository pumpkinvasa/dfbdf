import React, { useContext, useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  useTheme,
  Snackbar,
  Alert,
} from '@mui/material';
import { ThemeContext } from '../ThemeContext';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';
import LayersMenu, { LayerType } from '../components/LayersMenu';
import CompositesMenu, { CompositeType } from '../components/CompositesMenu';
import OpenLayersMap, { OpenLayersMapHandle } from '../components/OpenLayersMap';
import SearchLocation from '../components/SearchLocation';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { GeoJSON } from 'ol/format';
import ProgressOverlay from '../components/ProgressOverlay';
import { v4 as uuidv4 } from 'uuid';

interface GeoJSONFeature {
  type: string;
  geometry: any;
  properties: Record<string, any>;
}

const HomePage: React.FC = () => {
  const { themeMode, toggleTheme } = useContext(ThemeContext);
  const theme = useTheme();
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [mapZoom, setMapZoom] = useState<number | undefined>(undefined);
  const [activeDrawingTool, setActiveDrawingTool] = useState<'polygon' | 'rectangle' | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [featureCount, setFeatureCount] = useState(0);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [compositesMenuOpen, setCompositesMenuOpen] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<LayerType>('OSM');
  const [currentComposite, setCurrentComposite] = useState<CompositeType | null>(null);
  const [overlaySettings, setOverlaySettings] = useState({
    borders: false,
    contour: false,
    labels: true,
    roads: false
  });
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<OpenLayersMapHandle>(null);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleLocationSelect = useCallback((location: [number, number], zoom?: number) => {
    setMapCenter(location);
    if (zoom) setMapZoom(zoom);
  }, []);

  const handleToolSelect = useCallback((toolIndex: number) => {
    console.log(`Выбран инструмент ${toolIndex}`);
  }, []);
  const handleDrawingToolSelect = useCallback((tool: 'polygon' | 'rectangle' | 'upload') => {
    switch (tool) {
      case 'polygon':
        if (activeDrawingTool === 'polygon') {
          setActiveDrawingTool(null);
          setSnackbarMessage('Режим рисования полигона выключен');
          setSnackbarOpen(true);
        } else {
          setActiveDrawingTool('polygon');
          setSnackbarMessage(
            'Режим рисования полигона точками активирован. Кликайте для добавления точек, двойной клик для завершения.',
          );
          setSnackbarOpen(true);
        }
        break;
      case 'rectangle':
        if (activeDrawingTool === 'rectangle') {
          setActiveDrawingTool(null);
          setSnackbarMessage('Режим рисования прямоугольника выключен');
          setSnackbarOpen(true);
        } else {
          setActiveDrawingTool('rectangle');
          setSnackbarMessage(
            'Режим рисования прямоугольника активирован. Кликните в одном углу, затем кликните в противоположном углу для создания прямоугольника.',
          );
          setSnackbarOpen(true);
        }
        break;
      case 'upload':
        // Для загрузки файлов - всегда выключаем режим рисования
        setActiveDrawingTool(null);
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.geojson,.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (file) {
            setSnackbarMessage(`Загружается файл: ${file.name}`);
            setSnackbarOpen(true);

            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const geoJSON = JSON.parse(event.target?.result as string);
                if (mapRef.current && mapRef.current.loadGeoJSON) {
                  mapRef.current.loadGeoJSON(geoJSON);
                  setSnackbarMessage(`GeoJSON успешно загружен`);
                  setSnackbarOpen(true);
                }
              } catch (error) {
                setSnackbarMessage(`Ошибка загрузки GeoJSON: ${error}`);
                setSnackbarOpen(true);
              }
            };
            reader.readAsText(file);
          }
        };        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
        break;
    }
  }, [activeDrawingTool]);

  const handleFeatureAdded = useCallback((feature: any) => {
    console.log('Добавлен новый объект:', feature);
    setSnackbarMessage('Объект успешно создан');
    setSnackbarOpen(true);
    // Removed setActiveDrawingTool(null) to keep drawing tool active
  }, []);

  const handleFeatureCountChange = useCallback((count: number) => {
    setFeatureCount(count);
  }, []);
  const handleClearAllFeatures = useCallback(() => {
    if (mapRef.current) {
      if (mapRef.current.clearAllFeatures) {
        mapRef.current.clearAllFeatures();
      }
      // Очищаем временный прямоугольник и кнопку
      if (mapRef.current.clearTemporaryRectangle) {
        mapRef.current.clearTemporaryRectangle();
      }
      setSnackbarMessage('Все объекты удалены');
      setSnackbarOpen(true);
    }
  }, []);
  const handleCloseSnackbar = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  const handleLayersClick = useCallback(() => {
    setLayersMenuOpen(true);
    setCompositesMenuOpen(false);
  }, []);

  const handleCompositesClick = useCallback(() => {
    setCompositesMenuOpen(true);
    setLayersMenuOpen(false);
  }, []);

  const handleLayersMenuClose = useCallback(() => {
    setLayersMenuOpen(false);
    // Отключаем режим рисования при закрытии меню слоев
    if (activeDrawingTool) {
      setActiveDrawingTool(null);
      if (mapRef.current && mapRef.current.disableDrawingMode) {
        mapRef.current.disableDrawingMode();
      }
    }
  }, [activeDrawingTool]);

  const handleCompositesMenuClose = useCallback(() => {
    setCompositesMenuOpen(false);
  }, []);

  const handleLayerSelect = useCallback((layerId: LayerType) => {
    setCurrentLayer(layerId);
    setSnackbarMessage(`Выбран слой: ${layerId}`);
    setSnackbarOpen(true);
  }, []);

  const handleProgressUpdate = useCallback(async (progressData: { status: string; progress: number }) => {
    if (progressData.status === 'completed') {
      setIsAnalyzing(false);
      setAnalysisProgress(100);
      setTimeout(() => {
        setAnalysisProgress(0);
      }, 1000);
    } else if (progressData.status === 'processing') {
      setAnalysisProgress(progressData.progress);
    }
  }, []);
  // Setup progress endpoint
  useEffect(() => {
    // Create a route for the backend to send progress updates
    const progressEndpoint = '/api/progress-callback';
    
    const handleProgressCallback = async (req: Request) => {
      const data = await req.json();
      handleProgressUpdate(data);
      return new Response('OK', { status: 200 });
    };

    // Register the endpoint
    self.addEventListener('fetch', (event: any) => {
      if (event.request.url.endsWith(progressEndpoint)) {
        event.respondWith(handleProgressCallback(event.request));
      }
    });
  }, [handleProgressUpdate]);

  const handleCompositeSelect = useCallback(async (compositeId: CompositeType) => {
    setCurrentComposite(compositeId);
    
    // Check if there are any features on the map
    if (featureCount === 0 && mapRef.current) {
      // Show temporary rectangle if no features exist
      mapRef.current.showTemporaryRectangle();
      return;
    }

    // Only proceed with trenches analysis for now
    if (compositeId === 'trenches' && mapRef.current) {
      // Generate unique task ID
      const taskId = uuidv4();
      let coords: GeoJSONFeature[] = [];      // Get all features from the map
      if (mapRef.current) {
        const features = mapRef.current.exportFeatures();
        coords = features.map(feature => feature as GeoJSONFeature);
        console.log('Sending features:', coords); // Debug log
      }

      try {
        setIsAnalyzing(true);
        setAnalysisProgress(0);

        // Connect to WebSocket first
        if (wsRef.current) {
          wsRef.current.close();
        }

        const ws = new WebSocket(`ws://localhost:8888/ws/${taskId}`);
        wsRef.current = ws;        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.status === 'completed') {
            setIsAnalyzing(false);
            setAnalysisProgress(100);
            
            // Display the georeferenced image
            if (data.result && data.result.image && data.result.worldFile && mapRef.current) {
              mapRef.current.displayGeoReferencedImage(data.result.image, data.result.worldFile);
            }
            
            setTimeout(() => {
              setAnalysisProgress(0);
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
            }, 1000);
          } else if (data.status === 'processing') {
            setAnalysisProgress(data.progress);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setSnackbarMessage('Ошибка соединения с сервером');
          setSnackbarOpen(true);
          setIsAnalyzing(false);
        };

        // Wait for WebSocket connection
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => resolve();
          ws.onerror = () => reject(new Error('WebSocket connection failed'));
          setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
        });        // Send coordinates to backend
        const response = await fetch(`http://localhost:8888/get_long_trenches_composite/${taskId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coords: coords.map(feature => ({
              type: "Feature",
              geometry: {
                type: feature.geometry.type,
                coordinates: feature.geometry.coordinates
              },
              properties: {}
            }))
          })
        });        if (response.ok) {
          const data = await response.json();
          setSnackbarMessage(`Анализ начат: ${data.message}`);
        } else {
          const errorData = await response.json();
          console.error('Server error:', errorData); // Debug log
          throw new Error(errorData.detail || 'Failed to start analysis');
        }
      } catch (error) {
        console.error('Error:', error);
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        setSnackbarMessage('Ошибка при отправке данных');
      }
    }
    
    setSnackbarOpen(true);
  }, [featureCount]);

  // Add handler for temporary rectangle confirmation
  const handleTemporaryRectangleConfirm = useCallback(() => {
    // Clear the temporary rectangle
    if (mapRef.current) {
      mapRef.current.clearTemporaryRectangle();
    }
    setSnackbarMessage('Область анализа подтверждена');
    setSnackbarOpen(true);
  }, []);

  const handleOverlayChange = useCallback((overlay: string, checked: boolean) => {
    setOverlaySettings(prev => ({
      ...prev,
      [overlay]: checked
    }));
    setSnackbarMessage(`${checked ? 'Включен' : 'Выключен'} слой: ${overlay}`);
    setSnackbarOpen(true);
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Automated Earth Sensing App
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
            <SearchLocation onLocationSelect={handleLocationSelect} />
            <Tooltip title={`Переключить на ${themeMode === 'dark' ? 'светлую' : 'темную'} тему`}>
              <IconButton onClick={toggleTheme} color="inherit">
                {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          mt: '64px',
          overflow: 'hidden',
        }}
      >
        <LeftSidebar 
          onLayersClick={handleLayersClick}
          onCompositesClick={handleCompositesClick}
          layersMenuOpen={layersMenuOpen}
          compositesMenuOpen={compositesMenuOpen}
        />
        <Box
          sx={{
            flexGrow: 1,
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <OpenLayersMap
            ref={mapRef}
            initialCenter={[37.6173, 55.7558]}
            initialZoom={10}
            center={mapCenter}
            zoom={mapZoom}
            currentLayer={currentLayer}
            drawingTool={activeDrawingTool}
            onFeatureAdded={handleFeatureAdded}
            onFeatureCountChange={handleFeatureCountChange}
            overlaySettings={overlaySettings}
            onTemporaryRectangleConfirm={handleTemporaryRectangleConfirm}
            currentComposite={currentComposite}
          />
          <ProgressOverlay
            progress={analysisProgress}
            visible={isAnalyzing}
          />
        </Box>
        <RightSidebar
          onToolSelect={handleToolSelect}
          onDrawingToolSelect={handleDrawingToolSelect}
          onClearAllFeatures={handleClearAllFeatures}
          activeDrawingTool={activeDrawingTool}
          hasFeatures={featureCount > 0}
        />
        <LayersMenu
          open={layersMenuOpen}
          onClose={handleLayersMenuClose}
          onLayerSelect={handleLayerSelect}
          currentLayer={currentLayer}
        />
        <CompositesMenu
          open={compositesMenuOpen}
          onClose={handleCompositesMenuClose}
          onCompositeSelect={handleCompositeSelect}
          currentComposite={currentComposite}
        />
      </Box>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="info" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default HomePage;
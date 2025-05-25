import React, { useContext, useState, useRef, useCallback } from 'react';
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
  const mapRef = useRef<OpenLayersMapHandle>(null);

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
    if (mapRef.current && mapRef.current.clearAllFeatures) {
      mapRef.current.clearAllFeatures();
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

  const handleCompositeSelect = useCallback((compositeId: CompositeType) => {
    setCurrentComposite(compositeId);
    setSnackbarMessage(`Выбран композит: ${compositeId}`);
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
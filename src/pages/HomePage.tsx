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
import AOIMenu, { CompositeType, SatelliteType } from '../components/AOIMenu';
import SearchMenu, { SearchType } from '../components/SearchMenu';
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
  const [snackbarMessage, setSnackbarMessage] = useState('');  const [featureCount, setFeatureCount] = useState(0);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);  const [compositesMenuOpen, setCompositesMenuOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<LayerType>('OSM');
  const [currentComposite, setCurrentComposite] = useState<CompositeType | null>(null);
  const [currentSatellite, setCurrentSatellite] = useState<SatelliteType | null>(null);
  const [selectedSearches, setSelectedSearches] = useState<SearchType[]>([]);
  const [overlaySettings, setOverlaySettings] = useState({
    borders: false,
    contour: false,
    labels: true,
    roads: false
  });  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasTemporaryRectangle, setHasTemporaryRectangle] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('processing');
  const [analysisDetail, setAnalysisDetail] = useState<string>('');
  const [polygonCenter, setPolygonCenter] = useState<[number, number] | null>(null);
  const [polygonsVisible, setPolygonsVisible] = useState(true);
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
  }, []);  const handleClearAllFeatures = useCallback(() => {
    if (mapRef.current) {
      if (mapRef.current.clearAllFeatures) {
        mapRef.current.clearAllFeatures();
      }
      // Очищаем временный прямоугольник и кнопку
      if (mapRef.current.clearTemporaryRectangle) {
        mapRef.current.clearTemporaryRectangle();
      }
      setHasTemporaryRectangle(false);
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
    setSearchMenuOpen(false);
  }, []);

  const handleSearchClick = useCallback(() => {
    setSearchMenuOpen(true);
    setLayersMenuOpen(false);
    setCompositesMenuOpen(false);
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

  const handleSearchMenuClose = useCallback(() => {
    setSearchMenuOpen(false);
  }, []);
  const handleSearchSelect = useCallback((searchId: SearchType) => {
    setSelectedSearches(prev => {
      const isSelected = prev.includes(searchId);
      const newSelection = isSelected 
        ? prev.filter(id => id !== searchId)
        : [...prev, searchId];
        // Показываем уведомление о выбранном типе поиска
      const searchNames = {
        trenches: 'Поиск окопов',
        fortifications: 'Поиск укрепов', 
        buildings: 'Поиск построек',
        reservoirs: 'Проверка резервуаров',
        impact_analysis: 'Анализ места прилета'
      };
      
      const action = isSelected ? 'отключен' : 'включен';
      setSnackbarMessage(`${searchNames[searchId]} ${action}`);
      setSnackbarOpen(true);
      
      return newSelection;
    });
  }, []);  const handleStartAnalysis = useCallback(async () => {
    console.log('=== Запуск анализа ===');
    console.log('Выбранные типы поиска:', selectedSearches);
    console.log('Количество объектов на карте:', featureCount);
    
    if (selectedSearches.length === 0) {
      console.warn('Не выбраны типы поиска');
      setSnackbarMessage('Выберите хотя бы один тип поиска');
      setSnackbarOpen(true);
      return;
    }

    // Проверяем, есть ли области на карте
    if (featureCount === 0) {
      console.warn('Нет объектов на карте');
      setSnackbarMessage('Сначала нарисуйте область для анализа на карте');
      setSnackbarOpen(true);
      return;
    }

    const searchNames = {
      trenches: 'окопов',
      fortifications: 'укрепов', 
      buildings: 'построек',
      reservoirs: 'резервуаров',
      impact_analysis: 'мест прилета'
    };

    // Закрываем меню поиска
    setSearchMenuOpen(false);
    
    try {
      // Если выбран поиск окопов, запускаем сегментацию
      if (selectedSearches.includes('trenches')) {
        console.log('Запуск сегментации окопов...');
        await handleTrenchesSegmentation();
        console.log('Сегментация окопов завершена');
      }
      
      // TODO: Добавить обработку других типов анализа
      const selectedTypes = selectedSearches.map(type => searchNames[type]).join(', ');
      console.log('Анализ завершен для типов:', selectedTypes);
      setSnackbarMessage(`Запущен анализ для поиска: ${selectedTypes}`);
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('=== Ошибка при запуске анализа ===');
      console.error('Error details:', error);
      setSnackbarMessage(`Ошибка при запуске анализа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setSnackbarOpen(true);
    }
  }, [selectedSearches, featureCount]);
  const handleTrenchesSegmentation = useCallback(async () => {
    console.log('=== Начало сегментации окопов ===');
    
    if (!mapRef.current) {
      console.error('MapRef не инициализирован');
      setSnackbarMessage('Карта не инициализирована');
      setSnackbarOpen(true);
      return;
    }

    console.log('MapRef успешно инициализирован');

    try {
      // Генерируем уникальный ID задачи
      const taskId = uuidv4();
      console.log('Сгенерирован taskId:', taskId);
      
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setAnalysisStatus('processing');
      setAnalysisDetail('Получение изображения из области...');

      // Получаем base64 изображение из активного полигона
      let imageBase64: string;
      
      console.log('Проверяем наличие метода getPolygonImageBase64...');
      if (mapRef.current.getPolygonImageBase64) {
        console.log('Метод getPolygonImageBase64 найден, начинаем извлечение изображения...');
        imageBase64 = await mapRef.current.getPolygonImageBase64();
        console.log('Изображение извлечено, длина base64:', imageBase64?.length || 'undefined');
      } else {
        console.error('Метод getPolygonImageBase64 не найден в mapRef.current');
        throw new Error('Метод получения изображения недоступен');
      }

      if (!imageBase64) {
        console.error('Пустое изображение получено');
        throw new Error('Не удалось получить изображение из области');
      }

      setAnalysisDetail('Отправка на сегментацию...');
      setAnalysisProgress(25);

      // Подключаемся к WebSocket для отслеживания прогресса
      const ws = new WebSocket(`ws://localhost:8888/ws/${taskId}`);
      wsRef.current = ws;      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.status === 'completed') {
          console.log('Сегментация завершена через WebSocket');
          // Не устанавливаем isAnalyzing(false) здесь, 
          // это будет сделано после успешной замены изображения
          setAnalysisProgress(90);
          setAnalysisStatus('completed');
          setAnalysisDetail('Финализация результатов...');
        } else if (data.status === 'processing') {
          setAnalysisProgress(data.progress || 50);
          setAnalysisStatus(data.status);
          setAnalysisDetail(data.detail || 'Обработка...');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStatus('processing');
        setAnalysisDetail('');
      };

      // Ждем подключения WebSocket
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('WebSocket connection failed'));
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      // Отправляем запрос на сегментацию
      const response = await fetch(`http://localhost:8888/segment_trenches/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: imageBase64
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка сегментации');
      }      const result = await response.json();
      
      if (result.status === 'success' && result.result_image) {
        setAnalysisDetail('Применение результатов...');
        setAnalysisProgress(95);
        
        // Заменяем изображение на карте результатом сегментации
        if (mapRef.current.replacePolygonImage) {
          await mapRef.current.replacePolygonImage(result.result_image);
        }
        
        // Завершаем процесс анализа
        setAnalysisProgress(100);
        setAnalysisDetail('Сегментация завершена');
        
        setTimeout(() => {
          setIsAnalyzing(false);
          setAnalysisProgress(0);
          setAnalysisStatus('processing');
          setAnalysisDetail('');
          
          // Закрываем WebSocket
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        }, 1500);
        
        setSnackbarMessage('Сегментация окопов завершена успешно');
        setSnackbarOpen(true);
      } else {
        throw new Error(result.message || 'Неизвестная ошибка сегментации');
      }

    } catch (error) {
      console.error('Ошибка сегментации окопов:', error);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStatus('processing');
      setAnalysisDetail('');
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      setSnackbarMessage(`Ошибка сегментации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setSnackbarOpen(true);
    }
  }, []);

  const handleLayerSelect = useCallback((layerId: LayerType) => {
    setCurrentLayer(layerId);
    setSnackbarMessage(`Выбран слой: ${layerId}`);
    setSnackbarOpen(true);
  }, []);
  const handleProgressUpdate = useCallback(async (progressData: { 
    status: string; 
    progress: number; 
    detail?: string; 
  }) => {
    console.log('Progress update received:', progressData); // Debug log
    
    if (progressData.status === 'completed') {
      setIsAnalyzing(false);
      setAnalysisProgress(100);
      setAnalysisStatus('completed');
      setAnalysisDetail('');
      setTimeout(() => {
        setAnalysisProgress(0);
        setAnalysisStatus('processing');
      }, 1000);
    } else if (['processing', 'downloading', 'generating'].includes(progressData.status)) {
      setAnalysisProgress(progressData.progress);
      setAnalysisStatus(progressData.status);
      setAnalysisDetail(progressData.detail || '');
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
      setHasTemporaryRectangle(true);
      setSnackbarMessage('Нарисована предлагаемая область. Нажмите "Применить" для подтверждения или нарисуйте свою область.');
      setSnackbarOpen(true);
      return;
    }

    // Prevent analysis if there's a temporary rectangle waiting for confirmation
    if (hasTemporaryRectangle) {
      setSnackbarMessage('Сначала примените предложенную область или нарисуйте свою область.');
      setSnackbarOpen(true);
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
      }      try {
        setIsAnalyzing(true);
        setAnalysisProgress(0);
        setAnalysisStatus('processing');
        setAnalysisDetail('');
        
        // Автоматически закрываем меню композитов при начале обработки
        setCompositesMenuOpen(false);

        // Connect to WebSocket first
        if (wsRef.current) {
          wsRef.current.close();
        }

        const ws = new WebSocket(`ws://localhost:8888/ws/${taskId}`);
        wsRef.current = ws;        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data); // Debug log
          
          if (data.status === 'completed') {
            setIsAnalyzing(false);
            setAnalysisProgress(100);
            setAnalysisStatus('completed');
            setAnalysisDetail('');
            
            // Display the georeferenced image
            if (data.result && data.result.image && data.result.worldFile && mapRef.current) {
              mapRef.current.displayGeoReferencedImage(data.result.image, data.result.worldFile);
            }
            
            setTimeout(() => {
              setAnalysisProgress(0);
              setAnalysisStatus('processing');
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
            }, 1000);
          } else if (data.status === 'processing' || data.status === 'downloading' || data.status === 'generating') {
            setAnalysisProgress(data.progress || 0);
            setAnalysisStatus(data.status);
            setAnalysisDetail(data.detail || '');
          }
        };        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setSnackbarMessage('Ошибка соединения с сервером');
          setSnackbarOpen(true);
          setIsAnalyzing(false);
          setAnalysisProgress(0);
          setAnalysisStatus('processing');
          setAnalysisDetail('');
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
        }      } catch (error) {
        console.error('Error:', error);
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStatus('processing');
        setAnalysisDetail('');
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        setSnackbarMessage('Ошибка при отправке данных');
      }    }
    
    setSnackbarOpen(true);
  }, [featureCount, hasTemporaryRectangle]);  // Handler for satellite selection
  const handleSatelliteSelect = useCallback((satelliteId: SatelliteType) => {
    setCurrentSatellite(satelliteId);
    
    // Check if there are any features on the map
    if (featureCount === 0 && mapRef.current) {
      // Show temporary rectangle if no features exist
      mapRef.current.showTemporaryRectangle();
      setHasTemporaryRectangle(true);
      setSnackbarMessage(`Выбран спутник: ${satelliteId}. Нарисована предлагаемая область. Нажмите "Применить" для подтверждения или нарисуйте свою область.`);
      setSnackbarOpen(true);
      return;
    }

    // Prevent processing if there's a temporary rectangle waiting for confirmation
    if (hasTemporaryRectangle) {
      setSnackbarMessage('Сначала примените предложенную область или нарисуйте свою область.');
      setSnackbarOpen(true);
      return;
    }

    // If features exist, proceed with satellite data processing
    setSnackbarMessage(`Выбран спутник: ${satelliteId}. Обработка области...`);
    setSnackbarOpen(true);
    
    // TODO: Implement satellite data processing logic here
    console.log('Processing satellite data for:', satelliteId);
    console.log('Feature count:', featureCount);
  }, [featureCount, hasTemporaryRectangle]);

  // Handler for file upload
  const handleFileUpload = useCallback((files: FileList) => {
    const fileNames = Array.from(files).map(file => file.name).join(', ');
    setSnackbarMessage(`Загружены файлы: ${fileNames}`);
    setSnackbarOpen(true);
    
    // TODO: Implement actual file upload logic
    console.log('Files uploaded:', files);
  }, []);
  // Add handler for temporary rectangle confirmation
  const handleTemporaryRectangleConfirm = useCallback(() => {
    // Clear the temporary rectangle
    if (mapRef.current) {
      mapRef.current.clearTemporaryRectangle();
    }
    setHasTemporaryRectangle(false);
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
  const handlePolygonCenterChange = useCallback((center: [number, number] | null) => {
    setPolygonCenter(center);
  }, []);

  const handleToggleVisibility = useCallback(() => {
    if (mapRef.current && mapRef.current.togglePolygonsVisibility) {
      mapRef.current.togglePolygonsVisibility();
      setPolygonsVisible(prev => !prev);
      const message = polygonsVisible ? 'Полигоны скрыты' : 'Полигоны показаны';
      setSnackbarMessage(message);
      setSnackbarOpen(true);
    }
  }, [polygonsVisible]);

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
      >        <LeftSidebar 
          onLayersClick={handleLayersClick}
          onCompositesClick={handleCompositesClick}
          onSearchClick={handleSearchClick}
          layersMenuOpen={layersMenuOpen}
          compositesMenuOpen={compositesMenuOpen}
          searchMenuOpen={searchMenuOpen}
        />
        <Box
          sx={{
            flexGrow: 1,
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >          <OpenLayersMap
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
            onPolygonCenterChange={handlePolygonCenterChange}
          />          <ProgressOverlay
            progress={analysisProgress}
            visible={isAnalyzing}
            polygonCenter={polygonCenter}
            status={analysisStatus}
            detail={analysisDetail}
          />
        </Box>        <RightSidebar
          onToolSelect={handleToolSelect}
          onDrawingToolSelect={handleDrawingToolSelect}
          onClearAllFeatures={handleClearAllFeatures}
          activeDrawingTool={activeDrawingTool}
          hasFeatures={featureCount > 0}
          onToggleVisibility={handleToggleVisibility}
          polygonsVisible={polygonsVisible}
        />
        <LayersMenu
          open={layersMenuOpen}
          onClose={handleLayersMenuClose}
          onLayerSelect={handleLayerSelect}
          currentLayer={currentLayer}
        />        <AOIMenu
          open={compositesMenuOpen}
          onClose={handleCompositesMenuClose}
          onCompositeSelect={handleCompositeSelect}
          onSatelliteSelect={handleSatelliteSelect}
          onFileUpload={handleFileUpload}
          currentComposite={currentComposite}
          currentSatellite={currentSatellite}
        />        <SearchMenu
          open={searchMenuOpen}
          onClose={handleSearchMenuClose}
          onSearchSelect={handleSearchSelect}
          selectedSearches={selectedSearches}
          onStartAnalysis={handleStartAnalysis}
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
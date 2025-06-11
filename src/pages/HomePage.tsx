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
import DashboardMenu from '../components/DashboardMenu';
import OpenLayersMap, { OpenLayersMapHandle } from '../components/OpenLayersMap';
import SearchLocation from '../components/SearchLocation';
import FileUploadDialog from '../components/FileUploadDialog';
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

const ACCESS_KEY = "KCN8EFFcO6eTQEBAK4pwqrkhkm0YbGjwvYs_4vIcjMurz6_LXyDimO66IdEHNHD7";


const HomePage: React.FC = () => {
  const { themeMode, toggleTheme } = useContext(ThemeContext);
  const theme = useTheme();
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [mapZoom, setMapZoom] = useState<number | undefined>(undefined);
  const [activeDrawingTool, setActiveDrawingTool] = useState<'polygon' | 'rectangle' | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');  const [featureCount, setFeatureCount] = useState(0);  const [aoiPolygons, setAoiPolygons] = useState<any[]>([]);
    // Отладочное логирование состояния полигонов
  useEffect(() => {
    console.log('Состояние aoiPolygons изменилось:', aoiPolygons);
  }, [aoiPolygons]);

  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);const [compositesMenuOpen, setCompositesMenuOpen] = useState(false);
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
  const [analysisDetail, setAnalysisDetail] = useState<string>('');  const [polygonCenter, setPolygonCenter] = useState<[number, number] | null>(null);  const [polygonsVisible, setPolygonsVisible] = useState(true);
  const [fileUploadDialogOpen, setFileUploadDialogOpen] = useState(false);
  const [reservoirFile, setReservoirFile] = useState<File | null>(null);
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
        break;      case 'upload':
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
            reader.onload = (event) => {          try {
                const geoJSON = JSON.parse(event.target?.result as string);
                
                // Проверка загруженного файла
                if (!geoJSON || !geoJSON.features || !Array.isArray(geoJSON.features) || geoJSON.features.length === 0) {
                  throw new Error('Файл не содержит объектов GeoJSON');
                }
                
                console.log(`Загружено объектов: ${geoJSON.features.length}`);
                
                // Отображаем прогресс-бар на 15 секунд                setIsAnalyzing(true);
                setAnalysisStatus('downloading');
                setAnalysisDetail(`Загрузка резервуаров: ${file.name}`);
                  // Количество объектов для статистики
                const featureCount = geoJSON.features.length;
                const healthStatistics: {[key: string]: number} = {
                  '0': 0, // красный
                  '1': 0, // красный
                  '2': 0, // зеленый
                  '3': 0, // желтый
                  'unknown': 0
                };
                
                // Собираем статистику по здоровью резервуаров
                geoJSON.features.forEach((feature: any) => {
                  const health = feature.properties?.Здоровье;
                  if (health !== undefined) {
                    const healthKey = health.toString();
                    healthStatistics[healthKey] = (healthStatistics[healthKey] || 0) + 1;
                  } else {
                    healthStatistics['unknown']++;
                  }
                });
                
                // Симулируем прогресс загрузки в течение 15 секунд
                let progress = 0;
                let currentStage = 0;
                const stages = [
                  'Анализ структуры данных...',
                  'Проверка целостности координат...',
                  'Преобразование проекции...',
                  'Расчет параметров резервуаров...',
                  'Загрузка стилей отображения...',
                  'Применение цветовой схемы...',
                  'Финальная обработка...'
                ];
                
                const progressInterval = setInterval(() => {
                  progress += 100 / 15; // 15 секунд до 100%
                  
                  // Обновляем информационное сообщение на разных этапах прогресса
                  if (progress > currentStage * (100 / stages.length) && currentStage < stages.length) {
                    setAnalysisDetail(`${stages[currentStage]} (${featureCount} объектов)`);
                    currentStage++;
                  }
                  
                  if (progress >= 100) {
                    clearInterval(progressInterval);
                    progress = 100;
                      // После завершения прогресс-бара загружаем данные на карту
                    if (mapRef.current && mapRef.current.loadGeoJSON) {
                      // Очищаем предыдущие объекты перед загрузкой новых
                      mapRef.current.clearAllFeatures();
                      
                      // Загружаем GeoJSON на карту с раскраской по здоровью
                      mapRef.current.loadGeoJSON(geoJSON, undefined, true);
                      
                      // Обновляем список полигонов AOI после загрузки
                      if (mapRef.current.exportFeatures) {
                        const allFeatures = mapRef.current.exportFeatures();
                        setAoiPolygons(allFeatures);
                      }
                        // Формируем статистику по состоянию резервуаров
                      const healthSummary = `Зеленые: ${healthStatistics['2']}, Желтые: ${healthStatistics['3']}, Красные: ${healthStatistics['0'] + healthStatistics['1']}`;
                      
                      // Добавляем информацию о количестве загруженных объектов
                      setSnackbarMessage(`GeoJSON успешно загружен: ${featureCount} объектов. ${healthSummary}`);
                      
                      // Если это файл с резервуарами, устанавливаем флаг
                      if (file.name.toLowerCase().includes('oil') || 
                          file.name.toLowerCase().includes('reservoir') || 
                          (geoJSON.name && geoJSON.name.includes('БОЧКИ'))) {
                        setSelectedSearches(prev => {
                          if (!prev.includes('reservoirs')) {
                            return [...prev, 'reservoirs'];
                          }
                          return prev;
                        });
                      }
                    } else {
                      setSnackbarMessage(`Ошибка: карта не готова к отображению GeoJSON`);
                    }
                    
                    setIsAnalyzing(false);
                    setSnackbarOpen(true);
                  }
                  
                  setAnalysisProgress(progress);
                }, 1000); // обновляем каждую секунду
                
                // В случае ошибки убираем прогресс-бар
                setTimeout(() => {
                  if (isAnalyzing) {
                    clearInterval(progressInterval);
                    setIsAnalyzing(false);
                  }
                }, 16000); // таймаут чуть больше 15 секунд на всякий случай
              } catch (error) {
                console.error('Ошибка загрузки GeoJSON:', error);
                setSnackbarMessage(`Ошибка загрузки GeoJSON: ${error}`);
                setSnackbarOpen(true);
              }
            };
            reader.readAsText(file);
          }
        };document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
        break;
    }
  }, [activeDrawingTool]);  const handleFeatureAdded = useCallback((feature: any) => {
    console.log('Добавлен новый объект:', feature);
    setSnackbarMessage('Объект успешно создан');
    setSnackbarOpen(true);
    
    // Обновляем список полигонов AOI с задержкой, чтобы дать время карте обновиться
    setTimeout(() => {
      if (mapRef.current && mapRef.current.exportFeatures) {
        const allFeatures = mapRef.current.exportFeatures();
        console.log('Экспортированные объекты после добавления:', allFeatures);
        setAoiPolygons(allFeatures);
      } else {
        console.warn('mapRef.current или exportFeatures недоступны');
      }
    }, 100);
    // Removed setActiveDrawingTool(null) to keep drawing tool active
  }, []);  const handleFeatureCountChange = useCallback((count: number) => {
    setFeatureCount(count);
    
    // Также обновляем список полигонов AOI при изменении количества объектов
    if (mapRef.current && mapRef.current.exportFeatures) {
      const allFeatures = mapRef.current.exportFeatures();
      console.log('Обновление списка полигонов, количество:', count, 'объекты:', allFeatures);
      setAoiPolygons(allFeatures);
    }
  }, []);
  const handlePolygonsUpdate = useCallback((polygons: any[]) => {
    setAoiPolygons(polygons);
  }, []);

  const handlePolygonSelect = useCallback((polygonIndex: number) => {
    if (mapRef.current && mapRef.current.navigateToPolygon) {
      mapRef.current.navigateToPolygon(polygonIndex);
    }
  }, []);
  const handlePolygonZoom = useCallback((polygonIndex: number) => {
    if (mapRef.current && mapRef.current.navigateToPolygon) {
      mapRef.current.navigateToPolygon(polygonIndex);
    }
  }, []);

  const handlePolygonPartZoom = useCallback((polygonIndex: number, partIndex: number) => {
    if (mapRef.current && mapRef.current.navigateToPolygonPart) {
      mapRef.current.navigateToPolygonPart(polygonIndex, partIndex);
    }
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
      setHasTemporaryRectangle(false);
      setAoiPolygons([]); // Очищаем список полигонов AOI
      setSnackbarMessage('Все объекты удалены');
      setSnackbarOpen(true);
    }
  }, []);  const handleCloseSnackbar = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  const handleDashboardClick = useCallback(() => {
    setDashboardMenuOpen((prev) => !prev);
    setLayersMenuOpen(false);
    setCompositesMenuOpen(false);
    setSearchMenuOpen(false);
  }, []);
  const handleDashboardMenuClose = useCallback(() => {
    setDashboardMenuOpen(false);
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
    }  }, [activeDrawingTool]);
  
  const handleCompositesMenuClose = useCallback(() => {
    setCompositesMenuOpen(false);
  }, []);

  const handleSearchMenuClose = useCallback(() => {
    setSearchMenuOpen(false);
  }, []);  const handleSearchSelect = useCallback((searchId: SearchType) => {
    // Если выбирается "Проверка резервуаров" и она еще не выбрана, открываем диалог загрузки файла
    if (searchId === 'reservoirs' && !selectedSearches.includes(searchId)) {
      setFileUploadDialogOpen(true);
      return;
    }

    setSelectedSearches(prev => {
      const isSelected = prev.includes(searchId);
      const newSelection = isSelected 
        ? prev.filter(id => id !== searchId)
        : [...prev, searchId];
        
      // Если отключаем резервуары, очищаем загруженный файл
      if (searchId === 'reservoirs' && isSelected) {
        setReservoirFile(null);
      }
        
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
  }, [selectedSearches]);  // Обработчики для диалога загрузки файла резервуаров
  const handleFileUploadDialogClose = useCallback(() => {
    setFileUploadDialogOpen(false);
  }, []);
  const handleReservoirFileUpload = useCallback((file: File) => {
    setReservoirFile(file);
    setSelectedSearches(prev => [...prev, 'reservoirs']);
    
    // Загружаем содержимое файла и отображаем резервуары на карте
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const geoJSON = JSON.parse(event.target?.result as string);        if (mapRef.current && mapRef.current.loadGeoJSON) {
          mapRef.current.loadGeoJSON(geoJSON, undefined, true);
          setSnackbarMessage(`Файл ${file.name} загружен и резервуары отображены на карте. Проверка резервуаров включена.`);
        } else {
          setSnackbarMessage(`Файл ${file.name} загружен. Проверка резервуаров включена.`);
        }
      } catch (error) {
        setSnackbarMessage(`Ошибка загрузки GeoJSON: ${error}. Проверка резервуаров включена без отображения на карте.`);
      }
    };
    reader.readAsText(file);
    
    setSnackbarOpen(true);
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    console.log('=== Запуск анализа ===');
    console.log('Выбранные типы поиска:', selectedSearches);
    console.log('Количество объектов на карте:', featureCount);
    
    if (selectedSearches.length === 0) {
      console.warn('Не выбраны типы поиска');
      setSnackbarMessage('Выберите хотя бы один тип поиска');
      setSnackbarOpen(true);
      return;
    }    // Проверяем, есть ли области на карте
    if (featureCount === 0) {
      console.warn('Нет объектов на карте');
      setSnackbarMessage('Сначала нарисуйте область для анализа на карте');
      setSnackbarOpen(true);
      return;
    }

    // Проверяем, если выбрана проверка резервуаров, загружен ли файл
    if (selectedSearches.includes('reservoirs') && !reservoirFile) {
      console.warn('Не загружен файл для проверки резервуаров');
      setSnackbarMessage('Сначала загрузите .geojson файл для проверки резервуаров');
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
      
      // Если выбран поиск построек, запускаем детекцию
      if (selectedSearches.includes('buildings')) {
        console.log('Запуск детекции построек...');
        await handleBuildingsDetection();
        console.log('Детекция построек завершена');
      }
      
      // TODO: Добавить обработку других типов анализа
      const selectedTypes = selectedSearches.map(type => searchNames[type]).join(', ');
      console.log('Анализ завершен для типов:', selectedTypes);
      setSnackbarMessage(`Запущен анализ для поиска: ${selectedTypes}`);
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('=== Ошибка при запуске анализа ===');      console.error('Error details:', error);
      setSnackbarMessage(`Ошибка при запуске анализа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setSnackbarOpen(true);
    }  }, [selectedSearches, featureCount, reservoirFile]);
  const handleBuildingsDetection = useCallback(async () => {
    console.log('=== Начало детекции построек ===');
    
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
      setCurrentTaskId(taskId);
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

      setAnalysisDetail('Отправка на детекцию...');
      setAnalysisProgress(25);

      // Отправляем запрос на детекцию построек (без callback_url)
      const response = await fetch(`http://localhost:8888/v1/maps/detect_buildings/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_KEY}`,
        },
        body: JSON.stringify({
          image_base64: imageBase64
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка детекции');
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        setAnalysisDetail('Детекция запущена, ожидание результатов...');
        setAnalysisProgress(50);
        setSnackbarMessage('Детекция построек запущена');
        setSnackbarOpen(true);
      } else {
        throw new Error(result.message || 'Неизвестная ошибка детекции');
      }

    } catch (error) {
      console.error('Ошибка детекции построек:', error);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStatus('processing');
      setAnalysisDetail('');
      
      setSnackbarMessage(`Ошибка детекции: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setSnackbarOpen(true);
    }
  }, []);
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
      setCurrentTaskId(taskId);
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

      // Отправляем запрос на сегментацию (без callback_url)
      const response = await fetch(`http://localhost:8888/v1/maps/segment_trenches/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_KEY}`,
        },
        body: JSON.stringify({
          image_base64: imageBase64
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка сегментации');
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        setAnalysisDetail('Сегментация запущена, ожидание результатов...');
        setAnalysisProgress(50);
        setSnackbarMessage('Сегментация окопов запущена');
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
      
      setSnackbarMessage(`Ошибка сегментации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setSnackbarOpen(true);
    }
  }, []);
  const handleLayerSelect = useCallback((layerId: LayerType) => {
    setCurrentLayer(layerId);
    setSnackbarMessage(`Выбран слой: ${layerId}`);
    setSnackbarOpen(true);
  }, []);  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // SSE для получения обновлений анализа от бэкенда по taskId
  useEffect(() => {
    if (!currentTaskId) return;
    const eventSource = new EventSource(`http://localhost:8888/v1/maps/events/${currentTaskId}?api_key=${ACCESS_KEY}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        console.log('Получены данные SSE:', data);
        switch (data.type) {
          case 'progress':
            setAnalysisProgress(data.progress || 0);
            setAnalysisStatus(data.status || 'processing');
            setAnalysisDetail(data.detail || '');
            break;
          case 'status_detail':
            console.log('Status detail:', data);
            break;
          case 'final_result':
            if (data.status === 'completed' && data.result) {
              setAnalysisProgress(100);
              setAnalysisStatus('completed');
              setAnalysisDetail('Применение результатов...');
              if (data.result.image && data.result.worldFile && mapRef.current) {
                mapRef.current.displayGeoReferencedImage(data.result.image, data.result.worldFile);
              }
              setTimeout(() => {
                setIsAnalyzing(false);
                setAnalysisProgress(0);
                setAnalysisStatus('processing');
                setAnalysisDetail('');
              }, 1500);
              const taskType = data.task_id?.includes('trenches') ? 'композита окопов' : 
                data.task_id?.includes('buildings') ? 'детекции построек' :
                data.task_id?.includes('segment') ? 'сегментации окопов' : 'анализа';
              setSnackbarMessage(`Анализ ${taskType} завершен успешно`);
              setSnackbarOpen(true);
              eventSource.close();
              eventSourceRef.current = null;
              setCurrentTaskId(null);
            } else if (data.status === 'error') {
              setIsAnalyzing(false);
              setAnalysisProgress(0);
              setAnalysisStatus('processing');
              setAnalysisDetail('');
              setSnackbarMessage(`Ошибка анализа: ${data.error || 'Неизвестная ошибка'}`);
              setSnackbarOpen(true);
              eventSource.close();
              eventSourceRef.current = null;
              setCurrentTaskId(null);
            }
            break;
          default:
            console.log('Unknown SSE type:', data.type);
        }
      } catch (e) {
        console.error('Ошибка обработки SSE:', e);
      }
    };

    eventSource.onerror = function(error) {
      console.error('SSE ошибка:', error);
      eventSource.close();
      eventSourceRef.current = null;
      setCurrentTaskId(null);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [currentTaskId]);

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
      setCurrentTaskId(taskId);
      let coords: GeoJSONFeature[] = [];

      // Get all features from the map
      if (mapRef.current) {
        const features = mapRef.current.exportFeatures();
        coords = features.map(feature => feature as GeoJSONFeature);
        console.log('Sending features:', coords); // Debug log
      }

      try {
        setIsAnalyzing(true);
        setAnalysisProgress(0);
        setAnalysisStatus('processing');
        setAnalysisDetail('Инициализация анализа...');
        
        // Автоматически закрываем меню композитов при начале обработки
        setCompositesMenuOpen(false);

        // Отправляем координаты на бэкенд (без callback_url)
        const response = await fetch(`http://localhost:8888/v1/maps/get_long_trenches_composite/${taskId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ACCESS_KEY}`,
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
        });

        if (response.ok) {
          const data = await response.json();
          setAnalysisDetail('Анализ запущен, ожидание обновлений...');
          setSnackbarMessage(`Анализ начат: ${data.message}`);
          console.log('Analysis started with task ID:', taskId);
        } else {
          const errorData = await response.json();
          console.error('Server error:', errorData); // Debug log
          throw new Error(errorData.detail || 'Failed to start analysis');
        }
      } catch (error) {
        console.error('Error:', error);
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStatus('processing');
        setAnalysisDetail('');
        setSnackbarMessage('Ошибка при отправке данных');
      }
    }
    
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

  const [polygonVisibility, setPolygonVisibility] = useState<boolean[]>([]);

  // Сброс видимости при изменении списка полигонов
  useEffect(() => {
    if (mapRef.current && mapRef.current.exportFeatures) {
      const features = mapRef.current.exportFeatures();
      setPolygonVisibility(features.map((_, i) => {
        // Try to get visibility from feature property if possible
        if (mapRef.current && mapRef.current.getLoadedPolygons) {
          const loaded = mapRef.current.getLoadedPolygons();
          if (loaded[i] && typeof loaded[i].properties?.visible === 'boolean') {
            return loaded[i].properties.visible;
          }
        }
        return true;
      }));
    } else {
      setPolygonVisibility(aoiPolygons.map(() => true));
    }
  }, [aoiPolygons.length]);

  const handlePolygonToggleVisibility = useCallback((polygonIndex: number) => {
    setPolygonVisibility(prev => {
      const newVis = prev.map((v, i) => i === polygonIndex ? !v : v);
      if (mapRef.current && mapRef.current.setPolygonVisibilityByIndex) {
        mapRef.current.setPolygonVisibilityByIndex(polygonIndex, newVis[polygonIndex]);
      }
      return newVis;
    });
  }, [mapRef]);

  const handlePolygonDelete = useCallback((polygonIndex: number) => {
    if (mapRef.current && mapRef.current.removePolygonByIndex) {
      mapRef.current.removePolygonByIndex(polygonIndex);
      setSnackbarMessage('Полигон удалён');
      setSnackbarOpen(true);
    }
  }, [mapRef]);

  const [hoveredPolygonIndex, setHoveredPolygonIndex] = useState<number | null>(null);

  const handlePolygonHover = useCallback((polygonIndex: number | null) => {
    setHoveredPolygonIndex(polygonIndex);
    if (mapRef.current) {
      if (polygonIndex !== null && polygonIndex >= 0) {
        mapRef.current.setPolygonHoverByIndex(polygonIndex, true);
      }
      // Remove highlight from all others
      aoiPolygons.forEach((_, idx) => {
        if (idx !== polygonIndex) {
          mapRef.current!.setPolygonHoverByIndex(idx, false);
        }
      });
      if (polygonIndex === null) {
        aoiPolygons.forEach((_, idx) => {
          mapRef.current!.setPolygonHoverByIndex(idx, false);
        });
      }    }
  }, [mapRef, aoiPolygons]);
  const handleTerritoryPolygonAdd = useCallback((geoJSON: any) => {
    if (mapRef.current) {
      console.log('Добавление территориального полигона:', geoJSON);
      
      // Добавляем полигон на карту через новый метод
      if (mapRef.current.addGeoJSONFeature) {
        mapRef.current.addGeoJSONFeature(geoJSON);
      } else {
        console.error('Метод addGeoJSONFeature недоступен');
      }
      
      setSnackbarMessage(`Добавлен полигон: ${geoJSON.properties?.name || 'Территория'}`);
      setSnackbarOpen(true);
    }
  }, [mapRef]);

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
        }}      >        <LeftSidebar 
          onDashboardClick={handleDashboardClick}
          onLayersClick={handleLayersClick}
          onCompositesClick={handleCompositesClick}
          onSearchClick={handleSearchClick}
          dashboardMenuOpen={dashboardMenuOpen}
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
        />        <LayersMenu
          open={layersMenuOpen}
          onClose={handleLayersMenuClose}
          onLayerSelect={handleLayerSelect}
          currentLayer={currentLayer}
        /><AOIMenu
          open={compositesMenuOpen}
          onClose={handleCompositesMenuClose}
          onCompositeSelect={handleCompositeSelect}
          onSatelliteSelect={handleSatelliteSelect}
          onFileUpload={handleFileUpload}
          currentComposite={currentComposite}
          currentSatellite={currentSatellite}
        />        <DashboardMenu
          open={dashboardMenuOpen}
          onClose={handleDashboardMenuClose}
          aoiPolygons={aoiPolygons}
          onPolygonSelect={handlePolygonSelect}
          onPolygonToggleVisibility={handlePolygonToggleVisibility}
          onPolygonDelete={handlePolygonDelete}
          polygonVisibility={polygonVisibility}
          onPolygonHover={handlePolygonHover}
          hoveredPolygonIndex={hoveredPolygonIndex}
          onPolygonZoom={handlePolygonZoom}
          onTerritoryPolygonAdd={handleTerritoryPolygonAdd}
          onPolygonPartZoom={handlePolygonPartZoom}
        />
        
        <SearchMenu
          open={searchMenuOpen}
          onClose={handleSearchMenuClose}
          onSearchSelect={handleSearchSelect}
          selectedSearches={selectedSearches}
          onStartAnalysis={handleStartAnalysis}
          reservoirFile={reservoirFile}
        />

        <FileUploadDialog
          open={fileUploadDialogOpen}
          onClose={handleFileUploadDialogClose}
          onFileUpload={handleReservoirFileUpload}
          title="Загрузка файла резервуаров"
          description="Загрузите .geojson файл с данными резервуаров"
          acceptedFormats=".geojson,.json"
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
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  useTheme
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import MapIcon from '@mui/icons-material/Map';
import { TerritoryBounds, createPolygonFromBbox, getTerritoryBounds } from '../utils/territoryService';
import territoriesDataRaw from '../data/territories.json';
const territoriesData: any = territoriesDataRaw as any;

interface Territory {
  name: string;
  type: 'country' | 'state' | 'city';
  coordinates?: number[][][]; 
  bbox?: [number, number, number, number]; 
  parent?: string;
  countryCode?: string;
  stateCode?: string;
}

interface QuickPolygonSelectorProps {
  open: boolean;
  onClose: () => void;
  onTerritorySelect: (territory: Territory) => void;
}

const QuickPolygonSelector: React.FC<QuickPolygonSelectorProps> = ({
  open,
  onClose,
  onTerritorySelect
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [filteredTerritories, setFilteredTerritories] = useState<Territory[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Territory | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Territory | null>(null);
  const [availableRegions, setAvailableRegions] = useState<Territory[]>([]);
  const [step, setStep] = useState<'country' | 'region'>('country');  // Загрузка предустановленных территорий

  // --- Жёстко заданный список стран ---
  const staticCountries: Territory[] = territoriesData.countries.map((c: any) => ({
    name: c.name,
    type: 'country',
    countryCode: c.countryCode
  }));

  // Сброс всех состояний выбора
  const resetSelectorState = () => {
    setSelectedCountry(null);
    setSelectedRegion(null);
    setStep('country');
    setSearchValue('');
    setError(null);
    setAvailableRegions([]);
    setTerritories(staticCountries);
    setFilteredTerritories(staticCountries);
  };

  // При открытии компонента сразу подставляем РФ и Украину
  useEffect(() => {
    if (step === 'country') {
      setTerritories(staticCountries);
      setFilteredTerritories(staticCountries);
      setLoading(false);
      setError(null);
    }
  }, [step]);

  // Фильтрация по поисковому запросу только по этим двум странам
  useEffect(() => {
    if (step === 'country') {
      if (!searchValue.trim()) {
        setFilteredTerritories(staticCountries);
      } else {
        const filtered = staticCountries.filter(territory =>
          territory.name.toLowerCase().includes(searchValue.toLowerCase())
        );
        setFilteredTerritories(filtered);
      }
    }
  }, [searchValue, step]);

  // Фильтрация территорий при изменении поискового запроса
  useEffect(() => {
    if (step === 'country') {
      const countries = territories.filter(t => t.type === 'country');
      if (!searchValue.trim()) {
        setFilteredTerritories(countries);
      } else {
        const filtered = countries.filter(territory =>
          territory.name.toLowerCase().includes(searchValue.toLowerCase())
        );
        setFilteredTerritories(filtered);
      }
    } else if (step === 'region') {
      if (!searchValue.trim()) {
        setFilteredTerritories(availableRegions);
      } else {
        const filtered = availableRegions.filter(territory =>
          territory.name.toLowerCase().includes(searchValue.toLowerCase())
        );
        setFilteredTerritories(filtered);
      }
    }
  }, [searchValue, territories, step, availableRegions]);
  // Загрузка регионов для выбранной страны
  const loadRegions = async (countryCode: string) => {
    setLoading(true);
    setError(null);
    try {
      // Загрузка регионов из JSON
      const country = territoriesData.countries.find((c: any) => c.countryCode === countryCode);
      let regionsData: Territory[] = [];
      if (country && Array.isArray(country.regions)) {
        regionsData = country.regions.map((r: any) => ({
          name: r.name,
          type: 'state',
          parent: country.name,
          countryCode: country.countryCode,
          stateCode: r.stateCode
        }));
      }
      setAvailableRegions(regionsData);
      setFilteredTerritories(regionsData);
    } catch (err) {
      console.error('Error loading regions:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке регионов');
      setAvailableRegions([]);
      setFilteredTerritories([]);
    } finally {
      setLoading(false);
    }
  };

  // Обработка выбора страны
  const handleCountrySelect = async (territory: Territory | null) => {
    setSelectedCountry(territory);
    setSearchValue('');
    if (territory) {
      setLoading(true);
      setError(null);
      try {
        const bounds = await getTerritoryBounds(territory.name);
        if (bounds) {
          let territoryWithCoordinates: Territory;
          if (bounds.coordinates && bounds.coordinates.length > 0) {
            territoryWithCoordinates = {
              ...territory,
              coordinates: bounds.coordinates,
              bbox: bounds.bbox
            };
          } else if (bounds.bbox) {
            territoryWithCoordinates = {
              ...territory,
              coordinates: [createPolygonFromBbox(bounds.bbox)],
              bbox: bounds.bbox
            };
          } else {
            throw new Error('Координаты территории недоступны');
          }
          setSelectedCountry(territoryWithCoordinates);
          // Не переходим к областям автоматически!
        } else {
          throw new Error('Координаты территории недоступны');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка при получении границ страны');
      } finally {
        setLoading(false);
      }
    }
  };

  // Кнопка для перехода к выбору областей
  const handleGoToRegions = async () => {
    if (!selectedCountry) return;
    setStep('region');
    if (selectedCountry.countryCode) {
      await loadRegions(selectedCountry.countryCode);
    } else {
      setAvailableRegions([]);
    }
  };

  // Обработка выбора региона
  const handleRegionSelect = async (region: Territory | null) => {
    if (!region) {
      setSelectedRegion(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching bounds for region: ${region.name}`);
      const bounds = await getTerritoryBounds(region.name);
      console.log('Got region bounds:', bounds);
      
      if (bounds) {
        let regionWithCoordinates: Territory;
        
        if (bounds.coordinates && bounds.coordinates.length > 0) {
          console.log(`Found ${bounds.coordinates.length} coordinate sets for region`);
          // Если есть точные координаты границ, используем их
          regionWithCoordinates = {
            ...region,
            coordinates: bounds.coordinates,
            bbox: bounds.bbox
          };
        } else if (bounds.bbox) {
          console.log('Using bbox to create rectangular polygon for region');
          // Если нет точных координат, но есть bbox, создаем прямоугольный полигон
          regionWithCoordinates = {
            ...region,
            coordinates: [createPolygonFromBbox(bounds.bbox)],
            bbox: bounds.bbox
          };
        } else {
          throw new Error('Координаты региона недоступны');
        }
        
        console.log('Region with coordinates:', regionWithCoordinates);
        setSelectedRegion(regionWithCoordinates);
      } else {
        throw new Error('Координаты региона недоступны');
      }
    } catch (err) {
      console.error('Error fetching region bounds:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при получении границ региона');
      // Всё равно сохраняем выбранный регион, даже без координат
      setSelectedRegion(region);
    } finally {
      setLoading(false);
    }
  };

  // Обработка возврата к выбору страны
  const handleBackToCountry = () => {
    setStep('country');
    setSelectedRegion(null);
    setAvailableRegions([]);
    setSearchValue('');
    const countries = territories.filter(t => t.type === 'country');
    setFilteredTerritories(countries);
  };

  // Финальный выбор территории
  const handleFinalSelect = async (territory: Territory) => {
    setLoading(true);
    setError(null);

    try {
      let territoryWithCoordinates: Territory;

      if (territory.coordinates) {
        territoryWithCoordinates = territory;
      } else if (territory.bbox) {
        // Создаем простой прямоугольный полигон из bbox
        territoryWithCoordinates = {
          ...territory,
          coordinates: [createPolygonFromBbox(territory.bbox)]
        };
      } else {
        throw new Error('Координаты территории недоступны');
      }

      onTerritorySelect(territoryWithCoordinates);
      onClose();
      resetSelectorState(); // Сбросить состояния после добавления полигона
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании полигона');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: Territory['type']) => {
    switch (type) {
      case 'country':
        return <PublicIcon fontSize="small" />;
      case 'state':
        return <MapIcon fontSize="small" />;
      case 'city':
        return <LocationCityIcon fontSize="small" />;
    }
  };

  // Получение цвета чипа для типа территории
  const getTypeColor = (type: Territory['type']) => {
    switch (type) {
      case 'country':
        return 'primary';
      case 'state':
        return 'secondary';
      case 'city':
        return 'default';
    }
  };

  // Получение названия типа территории
  const getTypeName = (type: Territory['type']) => {
    switch (type) {
      case 'country':
        return 'Страна';
      case 'state':
        return 'Область/Штат';
      case 'city':
        return 'Город';
    }
  };
  const handleSelect = async () => {
    const targetTerritory = selectedRegion || selectedCountry;
    if (!targetTerritory) return;
    
    await handleFinalSelect(targetTerritory);
  };

  const handleClose = () => {
    resetSelectorState();
    onClose();
  };

  const getCurrentSelection = () => {
    return step === 'country' ? selectedCountry : selectedRegion;
  };

  const getStepTitle = () => {
    if (step === 'country') {
      return 'Выберите страну';
    } else {
      return `Выберите область в стране: ${selectedCountry?.name}`;
    }
  };

  const getPlaceholder = () => {
    if (step === 'country') {
      return 'Введите название страны...';
    } else {
      return 'Введите название области...';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: theme.palette.background.paper,
          backgroundImage: 'none',
        }
      }}
    >      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PublicIcon color="primary" />
          <Typography variant="h6">
            Быстрый полигон
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {getStepTitle()}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Кнопка возврата к выбору страны */}
        {step === 'region' && (
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleBackToCountry}
              sx={{ mb: 1 }}
            >
              ← Назад к выбору страны
            </Button>
            <Typography variant="body2" color="text.secondary">
              Выбранная страна: <strong>{selectedCountry?.name}</strong>
            </Typography>
          </Box>
        )}

        <Box sx={{ mb: 2 }}>
          <Autocomplete
            options={filteredTerritories}
            getOptionLabel={(option) => option.name}
            value={getCurrentSelection()}
            onChange={(_, value) => {
              if (step === 'country') {
                handleCountrySelect(value);
              } else {
                handleRegionSelect(value);
              }
            }}
            inputValue={searchValue}
            onInputChange={(_, value) => setSearchValue(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={step === 'country' ? 'Поиск страны' : 'Поиск области'}
                variant="outlined"
                fullWidth
                placeholder={getPlaceholder()}
                sx={{
                  '& .MuiInputBase-root': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiSvgIcon-root': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.divider,
                  },
                }}
                InputProps={{
                  ...params.InputProps
                }}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Box display="flex" alignItems="center" gap={1} width="100%">
                    {getTypeIcon(option.type)}
                    <Box flexGrow={1}>
                      <Typography variant="body1">
                        {option.name}
                      </Typography>
                      {option.parent && (
                        <Typography variant="caption" color="text.secondary">
                          {option.parent}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={getTypeName(option.type)}
                      size="small"
                      color={getTypeColor(option.type)}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              );
            }}
            noOptionsText={step === 'country' ? 'Страны не найдены' : 'Области не найдены'}
            loading={loading}
          />
        </Box>

        {/* Информация о выбранной территории */}
        {step === 'region' && availableRegions.length === 0 && selectedCountry && (
          <Box sx={{ p: 2, bgcolor: theme.palette.action.hover, borderRadius: 1, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Информация:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Для страны "{selectedCountry.name}" нет доступных областей. Будет создан полигон всей страны.
            </Typography>
          </Box>
        )}

        {getCurrentSelection() && (
          <Box sx={{ p: 2, bgcolor: theme.palette.background.default, color: theme.palette.text.primary, borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Выбранная территория:
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              {getTypeIcon(getCurrentSelection()!.type)}
              <Typography variant="body1" fontWeight="medium">
                {getCurrentSelection()!.name}
              </Typography>
              <Chip
                label={getTypeName(getCurrentSelection()!.type)}
                size="small"
                color={getTypeColor(getCurrentSelection()!.type)}
              />
            </Box>
            {getCurrentSelection()!.parent && (
              <Typography variant="body2" color="text.secondary">
                Входит в: {getCurrentSelection()!.parent}
              </Typography>
            )}            {getCurrentSelection()!.bbox && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Координаты: {getCurrentSelection()!.bbox!.map((coord: number) => coord.toFixed(4)).join(', ')}
              </Typography>
            )}
            {getCurrentSelection()!.coordinates && getCurrentSelection()!.coordinates!.length > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Территория состоит из {getCurrentSelection()!.coordinates!.length} отдельных частей
              </Typography>
            )}
            {/* Кнопка перехода к выбору областей внутри блока выбранной территории */}
            {step === 'country' && selectedCountry && (
              <Button
                onClick={handleGoToRegions}
                disabled={loading}
                variant="outlined"
                sx={{ mt: 2, color: theme.palette.primary.main, borderColor: theme.palette.primary.main }}
              >
                Выбрать область
              </Button>
            )}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Отмена
        </Button>
        
        {/* Кнопка продолжения/создания */}
        <Button
          onClick={handleSelect}
          variant="contained"
          disabled={!getCurrentSelection() || loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading 
            ? 'Создание...' 
            : step === 'country' && availableRegions.length === 0 && selectedCountry
              ? 'Создать полигон'
              : step === 'region'
                ? 'Создать полигон области'
                : 'Продолжить'
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickPolygonSelector;

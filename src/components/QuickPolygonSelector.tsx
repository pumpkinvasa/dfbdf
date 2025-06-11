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
import { TERRITORY_BOUNDARIES, TerritoryBounds, createPolygonFromBbox } from '../utils/territoryService';

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
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  // Загрузка предустановленных территорий
  useEffect(() => {
    const predefinedTerritories: Territory[] = Object.values(TERRITORY_BOUNDARIES);
    setTerritories(predefinedTerritories);
    setFilteredTerritories(predefinedTerritories);
  }, []);

  // Фильтрация территорий при изменении поискового запроса
  useEffect(() => {
    if (!searchValue.trim()) {
      setFilteredTerritories(territories);
      return;
    }

    const filtered = territories.filter(territory =>
      territory.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      territory.parent?.toLowerCase().includes(searchValue.toLowerCase())
    );
    setFilteredTerritories(filtered);
  }, [searchValue, territories]);
  // Создание полигона из bbox - уберем эту функцию, так как она теперь в сервисе
  // const createPolygonFromBbox = ...

  // Получение иконки для типа территории
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
    if (!selectedTerritory) return;

    setLoading(true);
    setError(null);

    try {
      let territoryWithCoordinates: Territory;

      if (selectedTerritory.coordinates) {
        territoryWithCoordinates = selectedTerritory;
      } else if (selectedTerritory.bbox) {
        // Создаем простой прямоугольный полигон из bbox
        territoryWithCoordinates = {
          ...selectedTerritory,
          coordinates: [createPolygonFromBbox(selectedTerritory.bbox)]
        };
      } else {
        throw new Error('Координаты территории недоступны');
      }

      onTerritorySelect(territoryWithCoordinates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании полигона');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTerritory(null);
    setSearchValue('');
    setError(null);
    onClose();
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
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PublicIcon color="primary" />
          <Typography variant="h6">
            Быстрый полигон
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Выберите страну, область или город для создания полигона
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Autocomplete
            options={filteredTerritories}
            getOptionLabel={(option) => option.name}
            value={selectedTerritory}
            onChange={(_, value) => setSelectedTerritory(value)}
            inputValue={searchValue}
            onInputChange={(_, value) => setSearchValue(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Поиск территории"
                variant="outlined"
                fullWidth
                placeholder="Введите название страны, области или города..."
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
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
            )}
            noOptionsText="Территории не найдены"
            loading={loading}
          />
        </Box>

        {selectedTerritory && (
          <Box sx={{ p: 2, bgcolor: theme.palette.action.hover, borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Выбранная территория:
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              {getTypeIcon(selectedTerritory.type)}
              <Typography variant="body1" fontWeight="medium">
                {selectedTerritory.name}
              </Typography>
              <Chip
                label={getTypeName(selectedTerritory.type)}
                size="small"
                color={getTypeColor(selectedTerritory.type)}
              />
            </Box>
            {selectedTerritory.parent && (
              <Typography variant="body2" color="text.secondary">
                Входит в: {selectedTerritory.parent}
              </Typography>
            )}
            {selectedTerritory.bbox && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Координаты: {selectedTerritory.bbox.map(coord => coord.toFixed(4)).join(', ')}
              </Typography>
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
        <Button
          onClick={handleSelect}
          variant="contained"
          disabled={!selectedTerritory || loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Создание...' : 'Создать полигон'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickPolygonSelector;

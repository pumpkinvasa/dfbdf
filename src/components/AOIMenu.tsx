import React, { useRef } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Divider,
  Button,
  useTheme
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CompareIcon from '@mui/icons-material/Compare';
import DifferenceIcon from '@mui/icons-material/Difference';
import SatelliteIcon from '@mui/icons-material/Satellite';
import RadioIcon from '@mui/icons-material/Radio';
import TerrainIcon from '@mui/icons-material/Terrain';
import UploadFileIcon from '@mui/icons-material/UploadFile';

export type CompositeType = 
  | 'trenches'
  | 'sarDiff';

export type SatelliteType = 
  | 'sentinel1'
  | 'sentinel2'
  | 'landsat';

interface Composite {
  id: CompositeType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface Satellite {
  id: SatelliteType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface AOIMenuProps {
  open: boolean;
  onClose: () => void;
  onCompositeSelect: (compositeId: CompositeType) => void;
  onSatelliteSelect?: (satelliteId: SatelliteType) => void;
  onFileUpload?: (files: FileList) => void;
  currentComposite: CompositeType | null;
  currentSatellite?: SatelliteType | null;
}

const compositeOptions: Composite[] = [
  { 
    id: 'trenches', 
    name: 'Долгие окопы', 
    icon: <CompareIcon />, 
    description: 'Анализ долгих окопов на местности'
  },
  { 
    id: 'sarDiff', 
    name: 'Отличия (SAR)', 
    icon: <DifferenceIcon />, 
    description: 'Анализ отличий с помощью SAR-снимков'
  }
];

const satelliteOptions: Satellite[] = [
  {
    id: 'sentinel1',
    name: 'Sentinel-1',
    icon: <RadioIcon />,
    description: 'Радиолокационные снимки SAR'
  },
  {
    id: 'sentinel2',
    name: 'Sentinel-2',
    icon: <SatelliteIcon />,
    description: 'Оптические мультиспектральные снимки'
  },
  {
    id: 'landsat',
    name: 'Landsat',
    icon: <TerrainIcon />,
    description: 'Спутниковые снимки Landsat'
  }
];

const AOIMenu: React.FC<AOIMenuProps> = ({ 
  open, 
  onClose, 
  onCompositeSelect, 
  onSatelliteSelect,
  onFileUpload,
  currentComposite,
  currentSatellite
}) => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && onFileUpload) {
      onFileUpload(files);
    }
  };
  
  return (    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      variant="temporary"
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      sx={{
        width: 300,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 300,
          boxSizing: 'border-box',
          marginTop: '64px', // Отступ сверху под AppBar
          height: 'calc(100% - 64px)', // Высота с учетом верхней панели
          marginLeft: '68px', // Отступ слева для левого сайдбара
          overflow: 'hidden', // Убираем общую прокрутку
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Заголовок - фиксированный */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        p: 1,
        flexShrink: 0 
      }}>
        <Typography variant="h6" sx={{ p: 1 }}>
          Заполнение AOI
        </Typography>
        <IconButton onClick={onClose}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ flexShrink: 0 }} />
      
      {/* Прокручиваемый контент */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        // Стилизация полосы прокрутки
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.05)' 
            : 'rgba(0, 0, 0, 0.05)',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(0, 0, 0, 0.2)',
          borderRadius: '3px',
          '&:hover': {
            background: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.3)' 
              : 'rgba(0, 0, 0, 0.3)',
          },
        },
        // Для Firefox
        scrollbarWidth: 'thin',
        scrollbarColor: theme.palette.mode === 'dark' 
          ? 'rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05)' 
          : 'rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05)',
      }}>
        
        {/* Раздел композитов */}
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle1" sx={{ px: 1, py: 0.5, fontWeight: 'bold' }}>
            Композиты
          </Typography>
          <List dense>
            {compositeOptions.map((composite) => (
              <ListItemButton
                key={composite.id}
                onClick={() => {
                  onCompositeSelect(composite.id);
                }}
                selected={currentComposite === composite.id}
                sx={{
                  mb: 0.5,
                  borderRadius: 1,
                }}
              >
                <ListItemIcon>
                  {composite.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={composite.name} 
                  secondary={composite.description}
                  primaryTypographyProps={{ 
                    fontWeight: currentComposite === composite.id ? 'bold' : 'normal' 
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Divider sx={{ mx: 2 }} />

        {/* Раздел спутников */}
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle1" sx={{ px: 1, py: 0.5, fontWeight: 'bold' }}>
            Спутники
          </Typography>
          <List dense>
            {satelliteOptions.map((satellite) => (
              <ListItemButton
                key={satellite.id}
                onClick={() => {
                  onSatelliteSelect?.(satellite.id);
                }}
                selected={currentSatellite === satellite.id}
                sx={{
                  mb: 0.5,
                  borderRadius: 1,
                }}
              >
                <ListItemIcon>
                  {satellite.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={satellite.name} 
                  secondary={satellite.description}
                  primaryTypographyProps={{ 
                    fontWeight: currentSatellite === satellite.id ? 'bold' : 'normal' 
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Divider sx={{ mx: 2 }} />        {/* Раздел загрузки файлов */}
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle1" sx={{ px: 1, py: 0.5, fontWeight: 'bold' }}>
            Загрузить файлы
          </Typography>
          <Box sx={{ px: 1, pb: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleFileUploadClick}
              startIcon={<UploadFileIcon />}
              sx={{
                py: 1,
                borderStyle: 'dashed',
                '&:hover': {
                  borderStyle: 'dashed',
                },
              }}
            >
              Загрузить PNG/GeoTIFF
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.tif,.tiff,.geotiff"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default AOIMenu;

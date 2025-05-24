import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Divider
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MapIcon from '@mui/icons-material/Map';
import SatelliteIcon from '@mui/icons-material/Satellite';
import TerrainIcon from '@mui/icons-material/Terrain';
import LandscapeIcon from '@mui/icons-material/Landscape';
import WaterIcon from '@mui/icons-material/Water';
import PublicIcon from '@mui/icons-material/Public';

export type LayerType = 
  | 'OSM' 
  | 'BingAerial' 
  | 'BingRoad' 
  | 'StamenTerrain' 
  | 'StamenWatercolor' 
  | 'StamenToner'
  | 'OpenTopoMap'
  | 'CartoDB';

interface Layer {
  id: LayerType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface LayersMenuProps {
  open: boolean;
  onClose: () => void;
  onLayerSelect: (layerId: LayerType) => void;
  currentLayer: LayerType;
}

const layerOptions: Layer[] = [
  { 
    id: 'OSM', 
    name: 'OpenStreetMap', 
    icon: <MapIcon />, 
    description: 'Стандартная карта OSM с улицами и зданиями'
  },
  { 
    id: 'BingAerial', 
    name: 'Спутник Bing', 
    icon: <SatelliteIcon />, 
    description: 'Спутниковые снимки от Bing Maps'
  },
  { 
    id: 'BingRoad', 
    name: 'Дороги Bing', 
    icon: <MapIcon />, 
    description: 'Дорожная карта от Bing Maps'
  },
  { 
    id: 'StamenTerrain', 
    name: 'Terrain', 
    icon: <TerrainIcon />, 
    description: 'Карта рельефа от Stamen'
  },
  { 
    id: 'StamenWatercolor', 
    name: 'Акварель', 
    icon: <WaterIcon />, 
    description: 'Художественная карта в стиле акварели'
  },
  { 
    id: 'StamenToner', 
    name: 'Toner', 
    icon: <MapIcon />, 
    description: 'Высококонтрастная черно-белая карта'
  },
  { 
    id: 'OpenTopoMap', 
    name: 'Топографическая', 
    icon: <LandscapeIcon />, 
    description: 'Топографическая карта с рельефом'
  },
  { 
    id: 'CartoDB', 
    name: 'CartoDB', 
    icon: <PublicIcon />, 
    description: 'Светлая карта от CartoDB'
  }
];

const LayersMenu: React.FC<LayersMenuProps> = ({ open, onClose, onLayerSelect, currentLayer }) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="temporary"
      sx={{
        width: 300,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 300,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1 }}>
        <Typography variant="h6" sx={{ p: 1 }}>
          Слои карты
        </Typography>
        <IconButton onClick={onClose}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
      
      <Divider />
      
      <List sx={{ p: 1 }}>
        {layerOptions.map((layer) => (
          <ListItemButton
            key={layer.id}
            onClick={() => {
              onLayerSelect(layer.id);
              onClose();
            }}
            selected={currentLayer === layer.id}
            sx={{
              mb: 0.5,
              borderRadius: 1,
            }}
          >
            <ListItemIcon>
              {layer.icon}
            </ListItemIcon>
            <ListItemText 
              primary={layer.name} 
              secondary={layer.description}
              primaryTypographyProps={{ fontWeight: currentLayer === layer.id ? 'bold' : 'normal' }}
            />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
};

export default LayersMenu;
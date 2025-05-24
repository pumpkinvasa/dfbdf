import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  IconButton, 
  Tooltip,
  useTheme,
  Popper,
  Paper,
  ClickAwayListener
} from '@mui/material';
import CreateIcon from '@mui/icons-material/Create';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PolylineIcon from '@mui/icons-material/Polyline';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';

interface RightSidebarProps {
  onToolSelect?: (toolIndex: number) => void;
  onDrawingToolSelect?: (tool: 'polygon' | 'rectangle' | 'upload') => void;
  onClearAllFeatures?: () => void;
  activeDrawingTool: string | null;
  hasFeatures: boolean;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ 
  onToolSelect, 
  onDrawingToolSelect,
  onClearAllFeatures,
  activeDrawingTool,
  hasFeatures
}) => {
  const [activeToolIndex, setActiveToolIndex] = useState<number | null>(null);
  const [drawingMenuOpen, setDrawingMenuOpen] = useState(false);
  const [showTooltips, setShowTooltips] = useState(true);
  const theme = useTheme();
  const drawingButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Список инструментов
  const tools = [
    { name: "Нарисовать полигон", icon: <PolylineIcon fontSize="small" /> },
    { name: "Инструмент 2", icon: <CloseIcon fontSize="small" /> },
    { name: "Инструмент 3", icon: <CloseIcon fontSize="small" /> },
    { name: "Инструмент 4", icon: <CloseIcon fontSize="small" /> },
  ];

  // Список инструментов рисования
  const drawingTools = [
    { name: "Нарисовать полигон точками", icon: <CreateIcon fontSize="small" />, type: 'polygon' as const },
    { name: "Нарисовать прямоугольник", icon: <CropSquareIcon fontSize="small" />, type: 'rectangle' as const },
    { name: "Загрузить GeoJSON", icon: <CloudUploadIcon fontSize="small" />, type: 'upload' as const },
    ...(hasFeatures ? [{ name: "Очистить все", icon: <DeleteIcon fontSize="small" />, type: 'clear' as const }] : []),
  ];
  
  // Обновляем активный инструмент при изменении внешнего состояния
  useEffect(() => {
    if (activeDrawingTool) {
      setActiveToolIndex(0);
    } else if (activeToolIndex === 0 && !activeDrawingTool) {
      setActiveToolIndex(null);
    }
  }, [activeDrawingTool, activeToolIndex]);
  
  // Обработчик выбора основного инструмента
  const handleToolClick = (index: number) => {
    if (index === 0) {
      if (activeToolIndex === 0 && !drawingMenuOpen) {
        setActiveToolIndex(null);
        if (onToolSelect) onToolSelect(-1);
        if (onDrawingToolSelect) onDrawingToolSelect('polygon');
      } else {
        setDrawingMenuOpen(!drawingMenuOpen);
        setShowTooltips(false);
        if (activeToolIndex !== 0) {
          setActiveToolIndex(0);
          if (onToolSelect) onToolSelect(0);
        }
      }
    } else {
      const newIndex = activeToolIndex === index ? null : index;
      setActiveToolIndex(newIndex);
      setDrawingMenuOpen(false);
      if (onToolSelect) {
        onToolSelect(newIndex !== null ? newIndex : -1);
      }
    }
  };

  // Обработчик выбора инструмента рисования
  const handleDrawingToolClick = (type: 'polygon' | 'rectangle' | 'upload' | 'clear') => {
    if (type === 'clear') {
      if (onClearAllFeatures) onClearAllFeatures();
    } else {
      if (onDrawingToolSelect) onDrawingToolSelect(type);
    }
    // Keep menu open for polygon/rectangle, close for upload/clear
    if (type !== 'upload' && type !== 'clear') {
      setDrawingMenuOpen(true);
    } else {
      setDrawingMenuOpen(false);
      setShowTooltips(true);
    }
  };

  // Закрыть меню при клике вне него, только если не активно рисование
  const handleClickAway = () => {
    if (!activeDrawingTool || activeDrawingTool === 'upload') {
      setDrawingMenuOpen(false);
      setShowTooltips(true);
    }
  };

  // Восстанавливаем тултипы при закрытии меню
  useEffect(() => {
    if (!drawingMenuOpen) {
      const timer = setTimeout(() => {
        setShowTooltips(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [drawingMenuOpen]);

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        bgcolor: theme.palette.mode === 'dark' 
          ? '#171B26' 
          : theme.palette.background.paper,
        borderRadius: '12px',
        boxShadow: theme.palette.mode === 'dark' 
          ? '0 4px 20px rgba(0,0,0,0.3)' 
          : '0 4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        p: 0.75,
        gap: 1,
        zIndex: 1200,
        border: theme.palette.mode === 'dark' 
          ? 'none' 
          : `1px solid ${theme.palette.divider}`,
      }}
    >
      {tools.map((tool, index) => (
        <Tooltip 
          key={index} 
          title={tool.name} 
          placement="left"
          arrow
          open={showTooltips && index !== 0 ? undefined : false}
          disableHoverListener={index === 0 && drawingMenuOpen}
        >
          <Box>
            <IconButton
              ref={index === 0 ? drawingButtonRef : null}
              size="small"
              sx={{
                width: 32,
                height: 32,
                minWidth: 32,
                minHeight: 32,
                bgcolor: activeToolIndex === index ? theme.palette.primary.main : 'transparent',
                color: activeToolIndex === index 
                  ? '#FFF' 
                  : theme.palette.mode === 'dark' 
                    ? '#FFFFFF' 
                    : theme.palette.text.primary,
                '&:hover': {
                  bgcolor: activeToolIndex === index 
                    ? theme.palette.primary.main 
                    : theme.palette.action.hover,
                },
                transition: 'all 0.2s',
                borderRadius: '8px',
                padding: 0.5,
              }}
              onClick={() => handleToolClick(index)}
            >
              {tool.icon}
            </IconButton>
          </Box>
        </Tooltip>
      ))}

      <Popper 
        open={drawingMenuOpen} 
        anchorEl={drawingButtonRef.current}
        placement="left"
        style={{ zIndex: 1300 }}
      >
        <ClickAwayListener onClickAway={handleClickAway}>
          <Paper 
            elevation={4}
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? '#2C3143' : theme.palette.background.paper,
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'row',
              p: 0.5,
              gap: 0.5,
              border: theme.palette.mode === 'dark' ? 'none' : `1px solid ${theme.palette.divider}`,
              mr: 1
            }}
          >
            {drawingTools.map((tool, idx) => (
              <Tooltip 
                key={idx} 
                title={tool.name} 
                placement="bottom"
                arrow
              >
                <IconButton
                  size="small"
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: activeDrawingTool === tool.type ? theme.palette.primary.main : 'transparent',
                    color: activeDrawingTool === tool.type 
                      ? '#FFF' 
                      : theme.palette.mode === 'dark' 
                        ? '#00E5C5' 
                        : theme.palette.primary.main,
                    '&:hover': {
                      bgcolor: activeDrawingTool === tool.type
                        ? theme.palette.primary.main
                        : theme.palette.action.hover,
                    },
                    borderRadius: '6px',
                  }}
                  onClick={() => handleDrawingToolClick(tool.type)}
                >
                  {tool.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
};

export default RightSidebar;
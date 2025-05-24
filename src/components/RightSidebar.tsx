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
  const theme = useTheme();
  const drawingButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Список инструментов
  const tools = [
    { name: "Инструменты AOI", icon: <PolylineIcon fontSize="small" /> },
    { name: "Инструмент 2", icon: <CloseIcon fontSize="small" /> },
    { name: "Инструмент 3", icon: <CloseIcon fontSize="small" /> },
    { name: "Инструмент 4", icon: <CloseIcon fontSize="small" /> },
  ];
  
  // Список инструментов рисования
  const drawingTools = [
    ...(hasFeatures ? [{ name: "Очистить все", icon: <DeleteIcon fontSize="small" />, type: 'clear' as const }] : []),
    { name: "Нарисовать полигон точками", icon: <CreateIcon fontSize="small" />, type: 'polygon' as const },
    { name: "Нарисовать прямоугольник", icon: <CropSquareIcon fontSize="small" />, type: 'rectangle' as const },
    { name: "Загрузить GeoJSON", icon: <CloudUploadIcon fontSize="small" />, type: 'upload' as const },
  ];
  
  // Обновляем активный инструмент при изменении внешнего состояния
  useEffect(() => {
    if (activeDrawingTool === 'polygon' || activeDrawingTool === 'rectangle') {
      setActiveToolIndex(0); // Первый инструмент - инструмент рисования
    } else if (activeToolIndex === 0 && !activeDrawingTool) {
      setActiveToolIndex(null);
    }
  }, [activeDrawingTool, activeToolIndex]);
  
  // Обработчик выбора основного инструмента
  const handleToolClick = (index: number) => {
    if (index === 0) {
      // Инструмент рисования
      if (activeToolIndex === 0 && drawingMenuOpen) {
        // Если уже активен и меню открыто - закрываем меню и деактивируем
        setDrawingMenuOpen(false);
        setActiveToolIndex(null);
      } else {
        // Активируем кнопку и показываем меню
        setActiveToolIndex(0);
        setDrawingMenuOpen(true);
        if (onToolSelect) onToolSelect(0);
      }
    } else {
      // Другие инструменты
      const newIndex = activeToolIndex === index ? null : index;
      setActiveToolIndex(newIndex);
      setDrawingMenuOpen(false);
      
      // Выключаем режим рисования при выборе другого инструмента
      if (activeDrawingTool && onDrawingToolSelect) {
        onDrawingToolSelect('polygon'); // Это вызовет переключение в HomePage
      }
      if (onToolSelect) {
        onToolSelect(newIndex !== null ? newIndex : -1);
      }
    }
  };
  
  // Обработчик выбора инструмента рисования
  const handleDrawingToolClick = (type: 'polygon' | 'rectangle' | 'upload' | 'clear') => {
    if (type === 'clear') {
      if (onClearAllFeatures) onClearAllFeatures();
      // Оставляем меню открытым после очистки
      setDrawingMenuOpen(true);
    } else {
      if (onDrawingToolSelect) onDrawingToolSelect(type);
      // Для polygon/rectangle оставляем меню открытым, для upload - закрываем
      if (type === 'upload') {
        setDrawingMenuOpen(false);
        setActiveToolIndex(null); // Выключаем активный инструмент после загрузки
      } else {
        // Для polygon/rectangle держим меню открытым
        setDrawingMenuOpen(true);
      }
    }
  };
  
  // Закрыть меню при клике вне него, но не если активно рисование
  const handleClickAway = () => {
    if (!activeDrawingTool) {
      setDrawingMenuOpen(false);
      // Если нет активного режима рисования, снимаем активность кнопки
      setActiveToolIndex(null);
    }
  };

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
          // Set title to empty string for the first button when menu is open
          title={index === 0 && drawingMenuOpen ? "" : tool.name}
          placement="left"
          arrow
          // Only open tooltips on hover
          enterTouchDelay={500}
        >
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
        </Tooltip>
      ))}
      
      <Popper 
        open={drawingMenuOpen && drawingButtonRef.current !== null} 
        anchorEl={drawingButtonRef.current}
        placement="left"
        style={{ zIndex: 1300 }}
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 0],
            },
          },
        ]}
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
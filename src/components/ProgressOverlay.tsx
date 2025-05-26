import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ProgressOverlayProps {
  progress: number;
  visible: boolean;
  polygonCenter?: [number, number] | null; // Координаты центра полигона в пикселях
  status?: string; // Статус выполнения (например, "downloading", "processing")
  detail?: string; // Детальная информация (например, "B04 2025-05")
}

const ProgressOverlay: React.FC<ProgressOverlayProps> = ({ 
  progress, 
  visible, 
  polygonCenter, 
  status = 'processing', 
  detail 
}) => {
  if (!visible) return null;

  // Определяем позицию: либо центр полигона, либо центр экрана
  const position = polygonCenter 
    ? {
        position: 'absolute' as const,
        left: polygonCenter[0],
        top: polygonCenter[1],
        transform: 'translate(-50%, -50%)',
      }
    : {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
  return (
    <Box
      sx={{
        ...position,
        bgcolor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 2,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        zIndex: 1000,
      }}
    >      <CircularProgress
        variant="determinate"
        value={progress}
        size={60}
        thickness={4}
        sx={{
          color: 'primary.main',
        }}
      />
      
      <Typography variant="h6" color="white" sx={{ textAlign: 'center' }}>
        {status === 'downloading' && 'Загрузка данных'}
        {status === 'processing' && 'Обработка данных'}
        {status === 'generating' && 'Генерация композита'}
        {status === 'completed' && 'Завершено'}
        {!['downloading', 'processing', 'generating', 'completed'].includes(status) && 'Выполнение'}
      </Typography>
      
      <Typography variant="body1" color="white" sx={{ textAlign: 'center' }}>
        {`${Math.round(progress)}%`}
      </Typography>
      
      {detail && (
        <Typography variant="body2" color="rgba(255, 255, 255, 0.8)" sx={{ textAlign: 'center' }}>
          {detail}
        </Typography>
      )}
    </Box>
  );
};

export default ProgressOverlay;

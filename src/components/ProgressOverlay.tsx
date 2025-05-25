import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ProgressOverlayProps {
  progress: number;
  visible: boolean;
}

const ProgressOverlay: React.FC<ProgressOverlayProps> = ({ progress, visible }) => {
  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        bgcolor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 2,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        zIndex: 1000,
      }}
    >
      <CircularProgress
        variant="determinate"
        value={progress}
        size={60}
        thickness={4}
        sx={{
          color: 'primary.main',
        }}
      />
      <Typography variant="h6" color="white">
        {`Анализ композита: ${progress}%`}
      </Typography>
    </Box>
  );
};

export default ProgressOverlay;

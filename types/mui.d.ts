import { Theme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Components {
    MuiSidebar?: {
      styleOverrides?: {
        root?: {
          backgroundColor?: string;
          color?: string;
          width?: string;
          boxShadow?: string;
        };
      };
    };
  }
}
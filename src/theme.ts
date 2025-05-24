import { createTheme, Theme, ThemeOptions } from '@mui/material/styles';
import { TypographyVariantsOptions } from '@mui/material/styles';

// Определяем палитру цветов для светлой темы
const lightPalette = {
  primary: {
    main: '#5D87FF',
    light: '#ECF2FF',
    dark: '#4570EA',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#49BEFF',
    light: '#E8F7FF',
    dark: '#23afdb',
    contrastText: '#ffffff',
  },
  success: {
    main: '#13DEB9',
    light: '#E6FFFA',
    dark: '#02b3a9',
    contrastText: '#ffffff',
  },
  info: {
    main: '#539BFF',
    light: '#EBF3FE',
    dark: '#1682d4',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#FFAE1F',
    light: '#FEF5E5',
    dark: '#ae8e59',
    contrastText: '#ffffff',
  },
  error: {
    main: '#FA896B',
    light: '#FDEDE8',
    dark: '#f3704d',
    contrastText: '#ffffff',
  },
  grey: {
    100: '#F2F6FA',
    200: '#EAEFF4',
    300: '#DFE5EF',
    400: '#7C8FAC',
    500: '#5A6A85',
    600: '#2A3547',
  },
  text: {
    primary: '#2A3547',
    secondary: '#5A6A85',
    disabled: '#DFE5EF',
  },
  action: {
    disabledBackground: 'rgba(73,82,88,0.12)',
    hoverOpacity: 0.02,
    hover: '#f6f9fc',
  },
  divider: '#e5eaef',
  background: {
    default: '#ffffff',
    paper: '#ffffff',
  },
};

// Определяем палитру цветов для темной темы
const darkPalette = {
  primary: {
    main: '#5D87FF',
    light: '#253662',
    dark: '#4570EA',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#49BEFF',
    light: '#1C455D',
    dark: '#23afdb',
    contrastText: '#ffffff',
  },
  success: {
    main: '#13DEB9',
    light: '#1B3C48',
    dark: '#02b3a9',
    contrastText: '#ffffff',
  },
  info: {
    main: '#539BFF',
    light: '#223662',
    dark: '#1682d4',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#FFAE1F',
    light: '#4D3A2A',
    dark: '#ae8e59',
    contrastText: '#ffffff',
  },
  error: {
    main: '#FA896B',
    light: '#4B313D',
    dark: '#f3704d',
    contrastText: '#ffffff',
  },
  grey: {
    100: '#333F55',
    200: '#465670',
    300: '#7C8FAC',
    400: '#DFE5EF',
    500: '#EAEFF4',
    600: '#F2F6FA',
  },
  text: {
    primary: '#EAEFF4',
    secondary: '#7C8FAC',
  },
  action: {
    disabledBackground: 'rgba(73,82,88,0.12)',
    hoverOpacity: 0.02,
    hover: '#333F55',
  },
  divider: '#333F55',
  background: {
    default: '#171c23',
    paper: '#171c23',
  },
};

// Общие настройки типографики для обеих тем
const typography: TypographyVariantsOptions = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  h1: {
    fontWeight: 600,
    fontSize: '2.25rem',
    lineHeight: '2.75rem',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  h2: {
    fontWeight: 600,
    fontSize: '1.875rem',
    lineHeight: '2.25rem',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  h3: {
    fontWeight: 600,
    fontSize: '1.5rem',
    lineHeight: '1.75rem',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  h4: {
    fontWeight: 600,
    fontSize: '1.3125rem',
    lineHeight: '1.6rem',
  },
  h5: {
    fontWeight: 600,
    fontSize: '1.125rem',
    lineHeight: '1.6rem',
  },
  h6: {
    fontWeight: 600,
    fontSize: '1rem',
    lineHeight: '1.2rem',
  },
  button: {
    // Исправляем эту строку с ошибкой
    textTransform: 'capitalize' as 'capitalize', // явное приведение типа
    fontWeight: 400,
  },
  body1: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: '1.334rem',
  },
  body2: {
    fontSize: '0.75rem',
    letterSpacing: '0rem',
    fontWeight: 400,
    lineHeight: '1rem',
  },
  subtitle1: {
    fontSize: '0.875rem',
    fontWeight: 400,
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 400,
  },
};

// Функция для создания настроек компонентов
const createComponents = (palette: any): ThemeOptions['components'] => {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        '.MuiPaper-elevation9, .MuiPopover-root .MuiPaper-elevation': {
          boxShadow: palette.mode === 'light' 
            ? 'rgb(145 158 171 / 30%) 0px 0px 2px 0px, rgb(145 158 171 / 12%) 0px 12px 24px -4px !important'
            : 'rgb(0 0 0 / 20%) 0px 0px 2px 0px, rgb(0 0 0 / 12%) 0px 12px 24px -4px !important',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '7px',
          padding: '0',
          boxShadow: '0px 7px 30px rgba(90, 114, 123, 0.11)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          '&:hover': {
            boxShadow: 'none',
          },
        },
        text: {
          fontWeight: 400,
        },
        contained: {
          color: '#fff',
          fontWeight: 400,
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: '9px',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: '9px',
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
          marginBottom: '3px',
        },
        title: {
          fontSize: '1.1rem',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '24px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${palette.mode === 'light' ? '#f6f9fc' : palette.divider}`,
          padding: '16px 24px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        filledSuccess: {
          color: 'white',
        },
        filledInfo: {
          color: 'white',
        },
        filledError: {
          color: 'white',
        },
        filledWarning: {
          color: 'white',
        },
        standardSuccess: {
          backgroundColor: palette.success.light,
          color: palette.success.main,
        },
        standardError: {
          backgroundColor: palette.error.light,
          color: palette.error.main,
        },
        standardWarning: {
          backgroundColor: palette.warning.light,
          color: palette.warning.main,
        },
        standardInfo: {
          backgroundColor: palette.info.light,
          color: palette.info.main,
        },
        outlinedSuccess: {
          borderColor: palette.success.main,
          color: palette.success.main,
        },
        outlinedWarning: {
          borderColor: palette.warning.main,
          color: palette.warning.main,
        },
        outlinedError: {
          borderColor: palette.error.main,
          color: palette.error.main,
        },
        outlinedInfo: {
          borderColor: palette.info.main,
          color: palette.info.main,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.mode === 'light' ? palette.grey[300] : palette.grey[200],
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.mode === 'light' ? palette.grey[300] : palette.grey[200],
          },
        },
        input: {
          padding: '12px 14px',
        },
        inputSizeSmall: {
          padding: '8px 14px',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.8rem',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: palette.divider,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 400,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontWeight: 400,
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontWeight: 400,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        outlined: {
          fontWeight: 'unset',
          marginBottom: '2px',
        },
      },
    },
  };
};

const baselightTheme: Theme = createTheme({
  palette: lightPalette,
  typography,
  components: createComponents({ ...lightPalette, mode: 'light' }),
});

const baseDarkTheme: Theme = createTheme({
  palette: darkPalette,
  typography,
  components: createComponents({ ...darkPalette, mode: 'dark' }),
});

export { baselightTheme, baseDarkTheme };
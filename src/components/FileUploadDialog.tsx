import React, { useCallback, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

interface FileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onFileUpload: (file: File) => void;
  title?: string;
  description?: string;
  acceptedFormats?: string;
}

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
  open,
  onClose,
  onFileUpload,
  title = 'Загрузка файла',
  description = 'Перетащите файл сюда или нажмите для выбора',
  acceptedFormats = '.geojson,.json'
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const geoJsonFile = files.find(file => 
      file.name.toLowerCase().endsWith('.geojson') || 
      file.name.toLowerCase().endsWith('.json')
    );
    
    if (geoJsonFile) {
      setSelectedFile(geoJsonFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleUpload = useCallback(() => {
    if (selectedFile) {
      onFileUpload(selectedFile);
      setSelectedFile(null);
      onClose();
    }
  }, [selectedFile, onFileUpload, onClose]);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedFile(null);
    onClose();
  }, [onClose]);

  return (    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      PaperProps={{
        sx: { minHeight: 400 }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CloudUploadIcon />
          {title}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Загрузите .geojson файл с данными резервуаров для анализа
          </Typography>
        </Box>

        {!selectedFile ? (
          <Paper
            variant="outlined"
            sx={{
              p: 4,
              textAlign: 'center',
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'grey.300',
              backgroundColor: dragOver ? 'action.hover' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.hover'
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <CloudUploadIcon 
              sx={{ 
                fontSize: 48, 
                color: dragOver ? 'primary.main' : 'grey.400',
                mb: 2 
              }} 
            />
            <Typography variant="h6" gutterBottom>
              {description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Поддерживаемые форматы: .geojson, .json
            </Typography>
            
            <input
              id="file-input"
              type="file"
              accept={acceptedFormats}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText
                  primary={selectedFile.name}
                  secondary={`Размер: ${(selectedFile.size / 1024).toFixed(1)} KB`}
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    onClick={handleRemoveFile}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>
          Отмена
        </Button>
        <Button 
          onClick={handleUpload}
          variant="contained"
          disabled={!selectedFile}
          startIcon={<CloudUploadIcon />}
        >
          Загрузить
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUploadDialog;
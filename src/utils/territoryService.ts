// Сервис для работы с границами территорий из OpenStreetMap
// Использует Nominatim API для поиска и Overpass API для получения границ

export interface TerritoryBounds {
  name: string;
  type: 'country' | 'state' | 'city';
  coordinates: number[][][];
  bbox: [number, number, number, number];
  parent?: string;
  countryCode?: string;
  stateCode?: string;
  osmId?: string;
  osmType?: 'relation' | 'way' | 'node';
}

// Интерфейсы для работы с OSM API
interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: string;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  geojson?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

// Функция для приведения координат к формату [долгота, широта]
function ensureLonLat(coords: any): any {
  // Если это точка
  if (Array.isArray(coords) && coords.length === 2 && 
      typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const [first, second] = coords;
    
    // Проверка на вероятную долготу (longitude) в первой координате
    // Долгота должна быть в диапазоне [-180, 180]
    // Широта должна быть в диапазоне [-90, 90]
    const isFirstLongitude = Math.abs(first) <= 180;
    const isSecondLatitude = Math.abs(second) <= 90;
    
    if (isFirstLongitude && isSecondLatitude) {
      // Уже в правильном формате [lon, lat]
      return coords;
    } else if (Math.abs(second) <= 180 && Math.abs(first) <= 90) {
      // Вероятно координаты перепутаны местами, возвращаем [lon, lat]
      return [second, first];
    } else {
      // Если координаты за пределами допустимых значений,
      // пробуем определить порядок по относительной величине
      if (Math.abs(first) > Math.abs(second)) {
        return [first, second]; // Большее значение вероятно долгота
      } else {
        return [second, first];
      }
    }
  }
  
  // Если это массив массивов (полигон или мультиполигон)
  if (Array.isArray(coords)) {
    return coords.map(c => ensureLonLat(c));
  }
  
  return coords;
}

// Получение границ территории через сторонний API
import { API_CONFIG } from '../config/apiConfig';

export async function fetchTerritoryGeoJson(territoryName: string, lang: string = 'ru', exclude_water: boolean = true): Promise<TerritoryBounds | null> {
  try {
    const response = await fetch(`${API_CONFIG.BOUNDARIES_BASE_URL}${API_CONFIG.ENDPOINTS.GET_BOUNDARIES()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.ACCESS_KEY}`
        },
        body: JSON.stringify({ name: territoryName, lang, exclude_water })
      }
    );
    const result = await response.json();
    if (result.status === 'success' && result.data && result.data.geojson && result.data.geojson.features && result.data.geojson.features.length > 0) {
      const feature = result.data.geojson.features[0];
      const geometry = feature.geometry;
      const coordinates = geometry.coordinates || [];
      const name = feature.properties?.name || feature.properties?.NAME || territoryName;
      const type = result.data.metadata?.type || 'country';
      // Вычисление bbox из geojson (минимальный прямоугольник)
      let bbox: [number, number, number, number] = [0,0,0,0];
      try {
        const allCoords = geometry.type === 'Polygon'
          ? geometry.coordinates.flat()
          : geometry.type === 'MultiPolygon'
            ? geometry.coordinates.flat(2)
            : [];
        if (allCoords.length > 0) {
          const lons = allCoords.map((c: number[]) => c[0]);
          const lats = allCoords.map((c: number[]) => c[1]);
          bbox = [
            Math.min(...lons),
            Math.min(...lats),
            Math.max(...lons),
            Math.max(...lats)
          ];
        }
      } catch {}
      return {
        name,
        type,
        coordinates,
        bbox,
        parent: result.data.metadata?.country || undefined,
        countryCode: result.data.metadata?.iso || undefined
      };
    }
    return null;
  } catch (e) {
    console.error('Ошибка получения границ через сторонний API:', e);
    return null;
  }
}

// Получить границы территории (только динамически через OSM)
export const getTerritoryBounds = async (territoryName: string): Promise<TerritoryBounds | null> => {
  return await fetchTerritoryGeoJson(territoryName);
};

// Поиск территорий (поиск только через Nominatim)
export const searchTerritories = async (query: string): Promise<TerritoryBounds[]> => {
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(query)}`;
  const nominatimResp = await fetch(nominatimUrl, { headers: { 'Accept-Language': 'ru' } });
  const nominatimData: NominatimResult[] = await nominatimResp.json();
  const results: TerritoryBounds[] = [];
  for (const place of nominatimData) {
    let coordinates: number[][][] = [];
    let bbox: [number, number, number, number] = [
      parseFloat(place.boundingbox[2]),
      parseFloat(place.boundingbox[0]),
      parseFloat(place.boundingbox[3]),
      parseFloat(place.boundingbox[1])
    ];
    if (place.geojson && place.geojson.type === 'Polygon') {
      coordinates = ensureLonLat(place.geojson.coordinates) as number[][][];    } else if (place.geojson && place.geojson.type === 'MultiPolygon') {
      // Правильная обработка MultiPolygon для поиска
      const multiPolygon = place.geojson.coordinates as number[][][][];
      coordinates = [];
      
      multiPolygon.forEach(polygon => {
        if (polygon && polygon.length > 0) {
          // Берем внешнее кольцо полигона (первый элемент)
          const outerRing = polygon[0];
          if (outerRing && outerRing.length > 0) {
            const processedPolygon = ensureLonLat(outerRing) as number[][];
            if (processedPolygon && processedPolygon.length > 0) {
              coordinates.push(processedPolygon);
            }
          }
        }
      });
    }
    if (coordinates.length) {
      results.push({
        name: place.display_name.split(',')[0],
        type: place.type === 'country' ? 'country' : (place.type === 'state' ? 'state' : 'city'),
        coordinates,
        bbox,
        osmId: String(place.osm_id),
        osmType: place.osm_type.toLowerCase() as 'relation' | 'way' | 'node',
        countryCode: place.class === 'boundary' ? undefined : place.class,
        parent: undefined
      });
    }
  }
  return results;
};

// Функция для создания простого прямоугольного полигона из bbox (оставлена для совместимости)
export const createPolygonFromBbox = (bbox: [number, number, number, number]): number[][] => {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat]
  ];
};

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

// Получение границ территории через Overpass API
async function fetchTerritoryGeoJson(territoryName: string): Promise<TerritoryBounds | null> {
  console.log(`Fetching GeoJSON for: "${territoryName}"`);
  
  // 1. Получаем OSM id через Nominatim
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(territoryName)}`;
  const nominatimResp = await fetch(nominatimUrl, { headers: { 'Accept-Language': 'ru' } });
  const nominatimData: NominatimResult[] = await nominatimResp.json();
  
  console.log('Nominatim response:', nominatimData);
  
  // Ищем именно страну (type === 'country' или place === 'country' или type === 'administrative')
  let place = nominatimData.find(p => p.type === 'country' || 
                                      p.type === 'administrative' && p.class === 'boundary');
  
  // Специальная обработка для России и Украины
  if (!place) {
    if (territoryName === 'Россия' || territoryName.toLowerCase() === 'russia') {
      console.log('Trying direct English search for Russia');
      const nominatimRespEn = await fetch('https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=Russia', 
        { headers: { 'Accept-Language': 'en' } });
      const nominatimDataEn: NominatimResult[] = await nominatimRespEn.json();
      console.log('English Nominatim response for Russia:', nominatimDataEn);
      // Ищем по более широким критериям
      place = nominatimDataEn.find(p => p.type === 'administrative' && p.class === 'boundary');
    } else if (territoryName === 'Украина' || territoryName.toLowerCase() === 'ukraine') {
      console.log('Trying direct English search for Ukraine');
      const nominatimRespEn = await fetch('https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=Ukraine', 
        { headers: { 'Accept-Language': 'en' } });
      const nominatimDataEn: NominatimResult[] = await nominatimRespEn.json();
      console.log('English Nominatim response for Ukraine:', nominatimDataEn);
      // Ищем по более широким критериям
      place = nominatimDataEn.find(p => p.type === 'administrative' && p.class === 'boundary');
    }
  }
  
  if (!place) {
    console.log('No place found for:', territoryName);
    return null;
  }

  console.log('Found place:', place);
  
  const osmType = place.osm_type.toLowerCase();
  const osmId = place.osm_id;

  // 2. Получаем данные границ
  let coordinates: number[][][] = [];
  let bbox: [number, number, number, number] = [
    parseFloat(place.boundingbox[2]), // minLon
    parseFloat(place.boundingbox[0]), // minLat
    parseFloat(place.boundingbox[3]), // maxLon
    parseFloat(place.boundingbox[1])  // maxLat
  ];

  console.log('Parsed bbox:', bbox);

  // Сначала пробуем получить координаты из GeoJSON
  if (place.geojson) {
    console.log('GeoJSON type:', place.geojson.type);
    
    if (place.geojson.type === 'Polygon') {
      console.log('Processing Polygon geometry');
      coordinates = ensureLonLat(place.geojson.coordinates) as number[][][];    } else if (place.geojson.type === 'MultiPolygon') {
      console.log('Processing MultiPolygon geometry');
      // Правильная обработка MultiPolygon для территорий с несколькими частями (как Россия)
      try {
        const multiPolygon = place.geojson.coordinates as number[][][][];
        
        // MultiPolygon состоит из массива полигонов
        // Каждый полигон представляет собой массив колец (первое - внешнее, остальные - дырки)
        coordinates = [];
        
        multiPolygon.forEach((polygon, idx) => {
          console.log(`Processing polygon ${idx} with ${polygon.length} rings`);
          if (polygon && polygon.length > 0) {
            // Берем внешнее кольцо полигона (первый элемент)
            const outerRing = polygon[0];
            if (outerRing && outerRing.length > 0) {
              const processedPolygon = ensureLonLat(outerRing) as number[][];
              if (processedPolygon && processedPolygon.length > 0) {
                coordinates.push(processedPolygon);
                console.log(`Added polygon ${idx} with ${processedPolygon.length} points`);
              }
            }
          }
        });
        
        console.log(`Total polygons processed: ${coordinates.length}`);
      } catch (err) {
        console.error('Error processing MultiPolygon:', err);
      }
    }
    console.log('Processed coordinates length:', coordinates.length);
  }

  // Если координат все еще нет, используем Overpass API как запасной вариант
  if (!coordinates.length) {
    console.log('No coordinates from GeoJSON, trying Overpass API');
    let overpassType = '';
    if (osmType === 'relation') overpassType = 'relation';
    else if (osmType === 'way') overpassType = 'way';
    else if (osmType === 'node') overpassType = 'node';
    else return null;

    const overpassQuery = `[out:json];${overpassType}(${osmId});out body;>;out skel qt;`;
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    console.log('Overpass query:', overpassQuery);
    
    const overpassResp = await fetch(overpassUrl, {
      method: 'POST',
      body: overpassQuery,
      headers: { 'Content-Type': 'text/plain' }
    });
    
    const overpassData = await overpassResp.json();
    console.log('Overpass response elements:', overpassData.elements?.length);
    
    if (overpassData.elements) {
      const rel = overpassData.elements.find((el: any) => el.type === overpassType && el.id == osmId);
      if (rel && rel.geometry) {
        coordinates = [[rel.geometry.map((p: any) => [p.lon, p.lat])]];
        console.log('Got coordinates from Overpass geometry');
      }
    }
  }

  // Если координат все еще нет, но есть bbox, создаем простой прямоугольник
  if ((!coordinates || coordinates.length === 0) && bbox) {
    console.log('Using bbox to create a simple polygon');
    // Корректное создание полигона из bbox
    const polygonFromBbox = createPolygonFromBbox(bbox);
    coordinates = [polygonFromBbox];
  }

  if (!coordinates || coordinates.length === 0) {
    console.log('No coordinates found at all');
    return null;
  }

  let territoryType: 'country' | 'state' | 'city';
  
  // Определение типа территории
  if (place.type === 'country' || (place.type === 'administrative' && place.class === 'boundary')) {
    territoryType = 'country';
  } else if (place.type === 'state') {
    territoryType = 'state';
  } else {
    territoryType = 'city';
  }

  const result: TerritoryBounds = {
    name: place.display_name.split(',')[0],
    type: territoryType,
    coordinates,
    bbox,
    osmId: String(osmId),
    osmType: osmType as 'relation' | 'way' | 'node',
    countryCode: place.class === 'boundary' ? undefined : place.class,
    parent: undefined
  };

  console.log('Returning result:', result);
  return result;
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

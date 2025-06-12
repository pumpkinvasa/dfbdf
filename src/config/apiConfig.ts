// Конфиг для API и ключей
export const API_CONFIG = {
  ACCESS_KEY: "KCN8EFFcO6eTQEBAK4pwqrkhkm0YbGjwvYs_4vIcjMurz6_LXyDimO66IdEHNHD7",
  BING_MAPS_KEY: "AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L",
  BASE_URL: "http://localhost:8888",
  ENDPOINTS: {
    DETECT_BUILDINGS: (taskId: string) => `/v1/maps/detect_buildings/${taskId}`,
    SEGMENT_TRENCHES: (taskId: string) => `/v1/maps/segment_trenches/${taskId}`,
    EVENTS: (taskId: string, apiKey: string) => `/v1/maps/events/${taskId}?api_key=${apiKey}`,
    LONG_TRENCHES_COMPOSITE: (taskId: string) => `/v1/maps/get_long_trenches_composite/${taskId}`,
    GET_BOUNDARIES: () => `/v1/maps/get_boundaries`,
  },
  BOUNDARIES_BASE_URL: "http://localhost:8888",
  TILE_URLS: {
    YANDEX: 'https://sat01.maps.yandex.net/tiles?l=sat&v=3.1025.0&x={x}&y={y}&z={z}&scale=1&lang=ru_RU',
    GOOGLE: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    ESRI_SAT: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ESRI_STREET: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    OSM: undefined, 
    BORDERS: 'https://tiles.wmflabs.org/osm-intl/{z}/{x}/{y}.png',
    CONTOUR: 'https://maps.refuges.info/hiking/{z}/{x}/{y}.png',
    LABELS: 'https://stamen-tiles-{a-d}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png',
    BING_ROADS: 'https://ecn.t0.tiles.virtualearth.net/tiles/h{quadkey}.jpeg?g=1',
    YANDEX_ROADS: 'https://vec01.maps.yandex.net/tiles?l=skl&v=20.06.03-0&x={x}&y={y}&z={z}&scale=1&lang=ru_RU',
    GOOGLE_ROADS: 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
    ESRI_TRANSPORT: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
  }
};

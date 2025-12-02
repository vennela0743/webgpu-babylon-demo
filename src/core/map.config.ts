const METERS_PER_DEGREE_LAT = 111_132;
const metersPerLonDegree = (lat: number) => Math.cos((lat * Math.PI) / 180) * 111_321;

export type GeoExtent = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

export type MapInfo = {
  label: string;
  textureUrl: string;
  ground: { width: number; height: number };
  unitsPerMeter: number;
  project: (lat: number, lon: number) => { x: number; z: number };
  center: { lat: number; lon: number };
  extent: GeoExtent;
};

type MapPresetConfig = {
  label: string;
  extent: GeoExtent;
  groundWidth: number;
  textureSize?: number;
  textureUrl?: string;
};

const buildOsmStaticMapUrl = (extent: GeoExtent, textureSize: number) => {
  const params = new URLSearchParams({
    bbox: `${extent.minLon},${extent.minLat},${extent.maxLon},${extent.maxLat}`,
    size: `${textureSize}x${textureSize}`,
    maptype: "mapnik",
  });
  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`;
};

export function createMapInfo(config: MapPresetConfig): MapInfo {
  const { extent, groundWidth } = config;
  const latRange = Math.max(extent.maxLat - extent.minLat, Number.EPSILON);
  const lonRange = Math.max(extent.maxLon - extent.minLon, Number.EPSILON);
  const latMid = (extent.minLat + extent.maxLat) / 2;
  const lonMid = (extent.minLon + extent.maxLon) / 2;

  const latMetersRange = latRange * METERS_PER_DEGREE_LAT;
  const lonMetersRange = lonRange * metersPerLonDegree(latMid);
  const usableLonMeters = lonMetersRange || 1;
  const unitsPerMeter = groundWidth / usableLonMeters;
  const groundHeight = Math.max(latMetersRange * unitsPerMeter, 1);

  const unitsPerDegreeLat = METERS_PER_DEGREE_LAT * unitsPerMeter;
  const unitsPerDegreeLon = metersPerLonDegree(latMid) * unitsPerMeter;

  const textureSize = config.textureSize ?? 2048;
  const textureUrl = config.textureUrl ?? buildOsmStaticMapUrl(extent, textureSize);

  return {
    label: config.label,
    textureUrl,
    ground: { width: groundWidth, height: groundHeight },
    unitsPerMeter,
    center: { lat: latMid, lon: lonMid },
    extent,
    project: (lat: number, lon: number) => ({
      x: (lon - lonMid) * unitsPerDegreeLon,
      z: -(lat - latMid) * unitsPerDegreeLat,
    }),
  };
}

export const JACKSONVILLE_DOWNTOWN = createMapInfo({
  label: "Downtown Jacksonville (OpenStreetMap)",
  extent: {
    minLat: 30.3222,
    maxLat: 30.3278,
    minLon: -81.6612,
    maxLon: -81.6538,
  },
  groundWidth: 420,
  textureSize: 2048,
});

export const DEFAULT_MAP = JACKSONVILLE_DOWNTOWN;


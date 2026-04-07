import { LV03toWGS, LV95toWGS } from 'swiss-projection'
import { GeoJSONPoint } from '../../../types/DirectusTypes'

/**
 * Converts Swiss LV03/LV95 coordinates to WGS84 GeoJSON Points
 * using the swiss-projection library.
 */
export default class SwissCoordinateConverter {
  /**
   * Converts Swiss coordinate strings from SOLV CSV to a GeoJSON Point (WGS84).
   * Returns null if coordinates are missing or invalid.
   *
   * SOLV CSV provides coord_x (easting) and coord_y (northing) in Swiss LV03 or LV95 format.
   */
  static toGeoJSONPoint(coordX: string, coordY: string): GeoJSONPoint | null {
    const x = parseFloat(coordX)
    const y = parseFloat(coordY)

    if (!x || !y) return null

    // WGS84 without decimal separator (e.g., 47197604 / 8789842 → 47.197604° / 8.789842°)
    // Swiss latitude ~46–48 scaled by 10^6 always exceeds 40'000'000,
    // well above the LV95 maximum of ~2'840'000
    if (x > 40_000_000 || y > 40_000_000) {
      const lat = Math.max(x, y) / 1_000_000
      const lng = Math.min(x, y) / 1_000_000
      return {
        type: 'Point',
        coordinates: [lng, lat],
      }
    }

    // LV95 easting is offset by +2'000'000 compared to LV03
    const isLV95 = x > 2_000_000
    const [lng, lat] = isLV95
      ? LV95toWGS([x, y])
      : LV03toWGS([x, y])

    return {
      type: 'Point',
      coordinates: [lng, lat],
    }
  }
}

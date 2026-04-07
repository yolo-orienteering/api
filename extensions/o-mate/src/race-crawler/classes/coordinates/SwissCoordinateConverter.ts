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

    let east = x
    let north = y

    // Ensure east is the larger value (easting ~480'000–840'000, northing ~75'000–300'000)
    if (east < north) {
      const tmp = east
      east = north
      north = tmp
    }

    // Detect LV95 (easting offset by +2'000'000) vs LV03
    const isLV95 = east > 2000000
    const [lng, lat] = isLV95
      ? LV95toWGS([east, north])
      : LV03toWGS([east, north])

    return {
      type: 'Point',
      coordinates: [lng, lat],
    }
  }
}

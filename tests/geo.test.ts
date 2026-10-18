import { describe, expect, it } from 'vitest'
import { regionOf } from '@/lib/geo'

describe('case map regions', () => {
  it('finds the province from a province, alias or city name', () => {
    expect(regionOf('province', 'Kabupaten Garut, Jawa Barat')).toBe('Jawa Barat')
    expect(regionOf('province', 'Kabupaten Sumba Timur, NTT')).toBe('Nusa Tenggara Timur')
    expect(regionOf('province', 'Kota Batam, Kepulauan Riau')).toBe('Kepulauan Riau')
    expect(regionOf('province', 'Kecamatan Tambun, Bekasi')).toBe('Jawa Barat')
    expect(regionOf('province', 'Kota Jakarta Barat, DKI Jakarta')).toBe('DKI Jakarta')
    expect(regionOf('province', 'somewhere far')).toBeNull()
  })
  it('finds the Demak kecamatan from a kecamatan or village, not from the regency name', () => {
    expect(regionOf('kecamatan', 'Kecamatan Sayung')).toBe('Sayung')
    expect(regionOf('kecamatan', 'Desa Timbulsloko')).toBe('Sayung')
    expect(regionOf('kecamatan', 'Desa Kalikondang, Demak')).toBe('Demak')
    expect(regionOf('kecamatan', 'Kota Demak')).toBe('Demak')
    expect(regionOf('kecamatan', 'Desa Wonosalam')).toBe('Wonosalam')
    expect(regionOf('kecamatan', 'Demak')).toBeNull()
  })
})

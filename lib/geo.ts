// Places cases on the agency's map: a province of Indonesia (KPAI) or a kecamatan of Demak regency (Dinsos P2PA
// Demak). The intake agent's location entity is free text ("Tambun, Bekasi", "Desa Timbulsloko"), so names are
// matched in code, most specific first, against the region names of the map and a small gazetteer.

export interface MapConfig {
  /** GeoJSON in Cloud Storage (geo/...); feature property `name` is the region name. */
  file: string
  level: 'province' | 'kecamatan'
}

const PROVINCES = [
  'Aceh',
  'Bali',
  'Kepulauan Bangka Belitung',
  'Banten',
  'Bengkulu',
  'Jawa Tengah',
  'Kalimantan Tengah',
  'Sulawesi Tengah',
  'Jawa Timur',
  'Kalimantan Timur',
  'Nusa Tenggara Timur',
  'Gorontalo',
  'DKI Jakarta',
  'Jambi',
  'Lampung',
  'Maluku Utara',
  'Maluku',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Sumatera Utara',
  'Papua Barat',
  'Papua',
  'Kepulauan Riau',
  'Riau',
  'Kalimantan Selatan',
  'Sulawesi Selatan',
  'Sumatera Selatan',
  'Sulawesi Tenggara',
  'DI Yogyakarta',
  'Jawa Barat',
  'Kalimantan Barat',
  'Nusa Tenggara Barat',
  'Sulawesi Barat',
  'Sumatera Barat',
]

/** Other ways a province is written, English names included. */
const PROVINCE_ALIASES: Record<string, string> = {
  ntt: 'Nusa Tenggara Timur',
  ntb: 'Nusa Tenggara Barat',
  jakarta: 'DKI Jakarta',
  yogyakarta: 'DI Yogyakarta',
  jogja: 'DI Yogyakarta',
  diy: 'DI Yogyakarta',
  'west java': 'Jawa Barat',
  'central java': 'Jawa Tengah',
  'east java': 'Jawa Timur',
  'north sumatra': 'Sumatera Utara',
  'west sumatra': 'Sumatera Barat',
  'south sumatra': 'Sumatera Selatan',
  'south sulawesi': 'Sulawesi Selatan',
  'north sulawesi': 'Sulawesi Utara',
  'riau islands': 'Kepulauan Riau',
  babel: 'Kepulauan Bangka Belitung',
}

/** Cities and regencies (kota, kabupaten) to their province: the common ones and those in the demo data. */
const CITIES: Record<string, string> = {
  bekasi: 'Jawa Barat',
  tambun: 'Jawa Barat',
  bogor: 'Jawa Barat',
  depok: 'Jawa Barat',
  bandung: 'Jawa Barat',
  garut: 'Jawa Barat',
  cirebon: 'Jawa Barat',
  tasikmalaya: 'Jawa Barat',
  sukabumi: 'Jawa Barat',
  karawang: 'Jawa Barat',
  cianjur: 'Jawa Barat',
  tangerang: 'Banten',
  serang: 'Banten',
  cilegon: 'Banten',
  semarang: 'Jawa Tengah',
  solo: 'Jawa Tengah',
  surakarta: 'Jawa Tengah',
  demak: 'Jawa Tengah',
  kudus: 'Jawa Tengah',
  magelang: 'Jawa Tengah',
  pekalongan: 'Jawa Tengah',
  tegal: 'Jawa Tengah',
  banyumas: 'Jawa Tengah',
  purwokerto: 'Jawa Tengah',
  surabaya: 'Jawa Timur',
  malang: 'Jawa Timur',
  sidoarjo: 'Jawa Timur',
  kediri: 'Jawa Timur',
  jember: 'Jawa Timur',
  banyuwangi: 'Jawa Timur',
  sleman: 'DI Yogyakarta',
  bantul: 'DI Yogyakarta',
  'jakarta barat': 'DKI Jakarta',
  'jakarta timur': 'DKI Jakarta',
  'jakarta selatan': 'DKI Jakarta',
  'jakarta utara': 'DKI Jakarta',
  'jakarta pusat': 'DKI Jakarta',
  grogol: 'DKI Jakarta',
  medan: 'Sumatera Utara',
  padang: 'Sumatera Barat',
  palembang: 'Sumatera Selatan',
  pekanbaru: 'Riau',
  batam: 'Kepulauan Riau',
  'banda aceh': 'Aceh',
  'bandar lampung': 'Lampung',
  makassar: 'Sulawesi Selatan',
  manado: 'Sulawesi Utara',
  kendari: 'Sulawesi Tenggara',
  palu: 'Sulawesi Tengah',
  pontianak: 'Kalimantan Barat',
  banjarmasin: 'Kalimantan Selatan',
  balikpapan: 'Kalimantan Timur',
  samarinda: 'Kalimantan Timur',
  denpasar: 'Bali',
  mataram: 'Nusa Tenggara Barat',
  lombok: 'Nusa Tenggara Barat',
  kupang: 'Nusa Tenggara Timur',
  sumba: 'Nusa Tenggara Timur',
  ambon: 'Maluku',
  jayapura: 'Papua',
  sorong: 'Papua Barat',
}

const KECAMATAN = [
  'Bonang',
  'Dempet',
  'Gajah',
  'Guntur',
  'Karanganyar',
  'Karangawen',
  'Karangtengah',
  'Kebonagung',
  'Mijen',
  'Mranggen',
  'Sayung',
  'Wedung',
  'Wonosalam',
  'Demak',
]
/** Villages (desa) of Demak regency named in reports, to their kecamatan. */
const VILLAGES: Record<string, string> = {
  kalikondang: 'Demak',
  bintoro: 'Demak',
  timbulsloko: 'Sayung',
  bedono: 'Sayung',
  sriwulan: 'Sayung',
  purwosari: 'Sayung',
  surodadi: 'Sayung',
  morodemak: 'Bonang',
  betahwalang: 'Bonang',
  kedungmutih: 'Wedung',
  batursari: 'Mranggen',
}

const has = (text: string, name: string) => new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(text)

/** The region of the map a case's location falls in, or null when the text names none. */
export function regionOf(level: MapConfig['level'], location: string | null | undefined): string | null {
  const text = (location ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (level === 'province') {
    // Longest names first, so "Papua Barat" wins over "Papua" and "Kepulauan Riau" over "Riau".
    for (const p of [...PROVINCES].sort((a, b) => b.length - a.length)) if (has(text, p.toLowerCase())) return p
    for (const [k, p] of Object.entries(PROVINCE_ALIASES)) if (has(text, k)) return p
    for (const [k, p] of Object.entries(CITIES).sort((a, b) => b[0].length - a[0].length)) if (has(text, k)) return p
    return null
  }
  for (const [k, kec] of Object.entries(VILLAGES)) if (has(text, k)) return kec
  // "Demak" alone is the regency; it names the kecamatan only as "Kecamatan Demak" or "Kota Demak".
  for (const k of KECAMATAN.slice(0, -1)) if (has(text, k.toLowerCase())) return k
  if (/(kecamatan|kec\.?|kota) demak/.test(text)) return 'Demak'
  return null
}

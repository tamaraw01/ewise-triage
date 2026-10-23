export function fixed4(n: number) {
  return n.toFixed(4).replace(".", ",");
}

// P1/P2/P3 identify handling types, not urgency or processing order.
export type LaneCode = 'P1' | 'P2' | 'P3' | 'MR';

export interface LaneDef {
  code: LaneCode;
  name: string;
  desc: string;
}

export const LANES: Record<LaneCode, LaneDef> = {
  P1: { code: 'P1', name: 'Penanganan khusus', desc: 'Penanganan khusus untuk potensi bahaya' },
  P2: { code: 'P2', name: 'Pemulihan komponen', desc: 'Pemisahan PCB dan komponen bernilai' },
  P3: { code: 'P3', name: 'Pembongkaran perangkat', desc: 'Pemisahan komponen dan material perangkat' },
  MR: { code: 'MR', name: 'Peninjauan manual', desc: 'Diperiksa petugas' }
};

export interface ClusterMeta {
  id: number;
  name: string;
  sub: string;
  n: number;
  sim: number;
  zs: number;
  dom: string;
  pur: number;
  lane: LaneCode;
  hazard: string | null;
  material: string;
  action: string;
}

export const HANDLING_SOURCES = [
  { name: 'WEEE, Annex VII', url: 'https://eur-lex.europa.eu/eli/dir/2012/19/oj' },
  { name: 'EPA: baterai Li-ion', url: 'https://www.epa.gov/recycle/used-lithium-ion-batteries' },
  { name: 'CPSC: keselamatan microwave', url: 'https://www.cpsc.gov/s3fs-public/micro.pdf' },
  { name: 'EPA: kaca CRT', url: 'https://www.epa.gov/hw/frequent-questions-about-regulation-used-cathode-ray-tubes-crts-and-crt-glass' },
  { name: 'USGS: logam pada ponsel', url: 'https://pubs.usgs.gov/fs/2006/3097/fs2006-3097.pdf' },
  { name: 'Permen LHK 9/2024', url: 'https://peraturan.bpk.go.id/Download/351283/Permen%20LHK%20No%209%20Tahun%202024.pdf' },
];

// Reference guidance, not photo findings. Evidence: docs/handling-evidence-2026-10-19.md.
export const CLUSTERS_META: Record<number, ClusterMeta> = {
  0: { id: 0, name: 'Keyboard', sub: 'Keyboard', n: 277, sim: .250, zs: .087, dom: 'Keyboard', pur: 89.9, lane: 'P3', hazard: 'Periksa baterai jika ada.', material: 'Belum dipastikan; perlu pemeriksaan fisik.', action: 'Petugas memeriksa baterai dan kabel sebelum pengolahan sesuai SOP.' },
  1: { id: 1, name: 'Mobile', sub: 'Ponsel & tablet', n: 286, sim: .258, zs: .092, dom: 'Mobile', pur: 99.3, lane: 'P2', hazard: 'Periksa baterai tertanam; Li-ion rusak dapat memicu kebakaran.', material: 'Ponsel berpotensi mengandung logam bernilai. Kandungan unit belum diukur; acuan ini tidak memastikan material tablet.', action: 'Petugas memeriksa baterai dan jenis perangkat sebelum pemisahan komponen sesuai SOP.' },
  2: { id: 2, name: 'Washing Machine', sub: 'Mesin cuci (kelompok C2)', n: 202, sim: .262, zs: .115, dom: 'Washing Machine', pur: 99.5, lane: 'P3', hazard: 'Bahaya listrik dan komponen internal perlu diperiksa.', material: 'Belum dipastikan; perlu pemeriksaan fisik.', action: 'Petugas memeriksa kondisi dan komponen sebelum pembongkaran sesuai SOP.' },
  3: { id: 3, name: 'PCB', sub: 'Papan sirkuit (PCB)', n: 232, sim: .280, zs: .085, dom: 'PCB', pur: 97.8, lane: 'P2', hazard: 'Periksa komponen yang perlu penanganan terpisah.', material: 'Potensi pemulihan material; kandungan logam belum diukur.', action: 'Serahkan papan sirkuit ke pengolah kompeten; pemisahan mengikuti SOP.' },
  4: { id: 4, name: 'Battery', sub: 'Baterai (ponsel/laptop)', n: 132, sim: .219, zs: .064, dom: 'Battery', pur: 100, lane: 'P1', hazard: 'Jika Li-ion, baterai rusak atau terminal yang korsleting dapat memicu kebakaran; kimia tidak diketahui dari foto', material: 'Bergantung kimia; belum dipastikan.', action: 'Konfirmasi jenis dan kondisi. Pisahkan dari jalur umum dan serahkan ke pengelola baterai yang sesuai. Baterai panas atau rusak mengikuti SOP darurat fasilitas.' },
  5: { id: 5, name: 'Washing Machine', sub: 'Mesin cuci (kelompok C5)', n: 93, sim: .234, zs: .110, dom: 'Washing Machine', pur: 100, lane: 'P3', hazard: 'Bahaya listrik dan komponen internal perlu diperiksa.', material: 'Belum dipastikan; perlu pemeriksaan fisik.', action: 'Petugas memeriksa kondisi dan komponen sebelum pembongkaran sesuai SOP.' },
  6: { id: 6, name: 'Microwave', sub: 'Microwave', n: 237, sim: .267, zs: .110, dom: 'Microwave', pur: 99.2, lane: 'P3', hazard: 'Risiko sengatan tetap ada meski steker dicabut.', material: 'Belum dipastikan; perlu pemeriksaan fisik.', action: 'Jangan buka casing sendiri. Serahkan pemeriksaan internal kepada teknisi kompeten.' },
  7: { id: 7, name: 'Mouse', sub: 'Mouse', n: 266, sim: .257, zs: .054, dom: 'Mouse', pur: 98.1, lane: 'P3', hazard: 'Periksa baterai jika ada.', material: 'Belum dipastikan; perlu pemeriksaan fisik.', action: 'Petugas memeriksa baterai dan kabel sebelum pengolahan sesuai SOP.' },
  8: { id: 8, name: 'Television', sub: 'Televisi (jenis layar belum pasti)', n: 133, sim: .248, zs: .099, dom: 'Television', pur: 98.5, lane: 'P3', hazard: 'Jika memakai lampu bermerkuri, perlu penanganan khusus.', material: 'Jenis layar dan material belum dipastikan.', action: 'Konfirmasi jenis layar. Serahkan lampu dan panel yang perlu perlakuan khusus ke pengolah kompeten.' },
  9: { id: 9, name: 'Mobile', sub: 'Perangkat campuran (perlu pemeriksaan)', n: 31, sim: .228, zs: .008, dom: 'Keyboard', pur: 25.8, lane: 'MR', hazard: null, material: 'Belum ditentukan.', action: 'Petugas mengonfirmasi kategori dan kondisi sebelum menentukan penanganan.' },
  10: { id: 10, name: 'Battery', sub: 'Baterai (jenis belum dikonfirmasi)', n: 80, sim: .256, zs: .102, dom: 'Battery', pur: 100, lane: 'P1', hazard: 'Kimia dan kondisi belum diketahui.', material: 'Bergantung kimia; belum dipastikan.', action: 'Konfirmasi jenis dan kondisi baterai. Jangan pilih pemulihan timbal sebelum kimia terverifikasi. Baterai panas atau rusak mengikuti SOP darurat fasilitas.' },
  11: { id: 11, name: 'Mobile', sub: 'Pemutar audio (kelas Player)', n: 243, sim: .149, zs: .022, dom: 'Player', pur: 99.6, lane: 'MR', hazard: null, material: 'Belum dipastikan; perlu pemeriksaan fisik.', action: 'Konfirmasi kategori dan baterai sebelum memilih penanganan sesuai SOP.' },
  12: { id: 12, name: 'Television', sub: 'Televisi (periksa kemungkinan CRT)', n: 174, sim: .296, zs: .085, dom: 'Television', pur: 93.7, lane: 'P1', hazard: 'Jika CRT terkonfirmasi, kaca corong dapat mengandung timbal; hindari pecah', material: 'Jika CRT terkonfirmasi, kaca memerlukan penilaian khusus.', action: 'Konfirmasi jenis layar. Hindari memecahkan CRT; serahkan ke pengolah kompeten.' },
  13: { id: 13, name: 'Printer', sub: 'Printer & faks', n: 274, sim: .284, zs: .101, dom: 'Printer', pur: 99.3, lane: 'P3', hazard: 'Periksa sisa toner/tinta dan keluarkan kartrid sesuai SOP', material: 'Belum dipastikan; perlu pemeriksaan fisik.', action: 'Petugas memisahkan kartrid sebelum pengolahan perangkat sesuai SOP.' }
};

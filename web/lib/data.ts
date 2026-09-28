import scatterRaw from "@/data/scatter.json";

export type ScatterPoint = {
  x: number;
  y: number;
  c: number;
};

export const scatter = scatterRaw as ScatterPoint[];

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export function fixed4(n: number) {
  return n.toFixed(4).replace(".", ",");
}

export type LaneCode = 'P1' | 'P2' | 'P3' | 'MR';

export interface LaneDef {
  code: LaneCode;
  name: string;
  desc: string;
  color: string;
}

export const LANES: Record<LaneCode, LaneDef> = {
  P1: { code: 'P1', name: 'Jalur Prioritas 1', desc: 'Penanganan bahan berbahaya', color: 'var(--lane1)' },
  P2: { code: 'P2', name: 'Jalur Prioritas 2', desc: 'High-Value Harvesting', color: 'var(--lane2)' },
  P3: { code: 'P3', name: 'Jalur Prioritas 3', desc: 'Pembongkaran & pemulihan material', color: 'var(--lane3)' },
  MR: { code: 'MR', name: 'Peninjauan manual', desc: 'Diperiksa petugas', color: 'var(--laneM)' }
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

export const CLUSTERS_META: Record<number, ClusterMeta> = {
  0: { id: 0, name: 'Keyboard', sub: 'Keyboard', n: 277, sim: .250, zs: .087, dom: 'Keyboard', pur: 89.9, lane: 'P3', hazard: null, material: 'Plastik, membran karet, PCB pengendali kecil', action: 'Lepas kabel dan PCB pengendali, lalu cacah casing plastik.' },
  1: { id: 1, name: 'Mobile', sub: 'Ponsel & tablet', n: 286, sim: .258, zs: .092, dom: 'Mobile', pur: 99.3, lane: 'P2', hazard: 'Baterai Li-ion tertanam: lepas sebelum dibongkar', material: 'PCB berlapis emas, tembaga, layar', action: 'Lepas baterai Li-ion lebih dulu, lalu panen PCB untuk pemulihan logam mulia.' },
  2: { id: 2, name: 'Washing Machine', sub: 'Mesin cuci bukaan depan', n: 202, sim: .262, zs: .115, dom: 'Washing Machine', pur: 99.5, lane: 'P3', hazard: null, material: 'Baja, motor tembaga, pemberat beton', action: 'Jalur barang besar: lepas pemberat dan motor, pisahkan baja dan tembaga.' },
  3: { id: 3, name: 'PCB', sub: 'Precious Material / PCB', n: 232, sim: .280, zs: .085, dom: 'PCB', pur: 97.8, lane: 'P2', hazard: null, material: 'Emas, perak, paladium, tembaga', action: 'Arahkan ke Jalur Prioritas 2 (High-Value Harvesting) untuk pemulihan logam mulia.' },
  4: { id: 4, name: 'Battery', sub: 'Baterai Li-ion ponsel/laptop', n: 132, sim: .219, zs: .064, dom: 'Battery', pur: 100, lane: 'P1', hazard: 'Risiko kebakaran di fasilitas pengolahan (Li-ion)', material: 'Litium, kobalt, nikel', action: 'Tutup terminal dengan isolasi, simpan di wadah tahan api terpisah, jangan dicacah.' },
  5: { id: 5, name: 'Washing Machine', sub: 'Mesin cuci bukaan atas', n: 93, sim: .234, zs: .110, dom: 'Washing Machine', pur: 100, lane: 'P3', hazard: null, material: 'Baja, motor tembaga, plastik', action: 'Jalur barang besar: bongkar dari atas, pisahkan tabung, motor, dan rangka.' },
  6: { id: 6, name: 'Microwave', sub: 'Microwave', n: 237, sim: .267, zs: .110, dom: 'Microwave', pur: 99.2, lane: 'P3', hazard: 'Kapasitor tegangan tinggi: kosongkan muatan dulu', material: 'Baja, transformator tembaga, magnetron', action: 'Kosongkan muatan kapasitor, lalu ambil transformator dan magnetron secara utuh.' },
  7: { id: 7, name: 'Mouse', sub: 'Mouse', n: 266, sim: .257, zs: .054, dom: 'Mouse', pur: 98.1, lane: 'P3', hazard: null, material: 'Plastik, PCB kecil, kabel tembaga', action: 'Gabungkan dengan perangkat input kecil untuk pencacahan plastik dan pemisahan PCB.' },
  8: { id: 8, name: 'Television', sub: 'TV layar datar', n: 133, sim: .248, zs: .099, dom: 'Television', pur: 98.5, lane: 'P3', hazard: 'Periksa lampu latar CCFL (merkuri) pada panel LCD lama', material: 'Panel LCD, PCB driver, rangka logam', action: 'Lepas panel dan lampu latar secara utuh, lalu panen PCB driver.' },
  9: { id: 9, name: 'Mobile', sub: 'Cluster campuran (ambigu)', n: 31, sim: .228, zs: .008, dom: 'Keyboard', pur: 25.8, lane: 'MR', hazard: null, material: 'Campuran', action: 'Nama cluster tidak dapat dipercaya. Petugas menentukan jenis perangkat.' },
  10: { id: 10, name: 'Battery', sub: 'Sel silinder & aki', n: 80, sim: .256, zs: .102, dom: 'Battery', pur: 100, lane: 'P1', hazard: 'Timbal dan asam sulfat pada aki', material: 'Timbal, asam sulfat, seng, mangan', action: 'Simpan tegak di wadah tahan asam, kirim ke jalur pemulihan timbal.' },
  11: { id: 11, name: 'Mobile', sub: 'Pemutar audio (kelas asli: Player)', n: 243, sim: .149, zs: .022, dom: 'Player', pur: 99.6, lane: 'MR', hazard: null, material: 'Plastik, PCB, motor kecil', action: 'Nama zero-shot cluster ini keliru (Mobile). Petugas mengonfirmasi jenis perangkat.' },
  12: { id: 12, name: 'Television', sub: 'TV tabung CRT', n: 174, sim: .296, zs: .085, dom: 'Television', pur: 93.7, lane: 'P1', hazard: 'Kaca corong CRT mengandung timbal', material: 'Kaca panel & corong, tembaga, baja', action: 'Tangani utuh; pisahkan kaca panel dan kaca corong untuk perlakuan khusus.' },
  13: { id: 13, name: 'Printer', sub: 'Printer & faks', n: 274, sim: .284, zs: .101, dom: 'Printer', pur: 99.3, lane: 'P3', hazard: 'Sisa toner/tinta: keluarkan kartrid', material: 'Plastik, motor, baja, PCB', action: 'Keluarkan kartrid toner/tinta, lalu bongkar motor dan PCB.' }
};

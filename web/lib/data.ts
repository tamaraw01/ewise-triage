import analysisFlow from "../data/analysis-flow.json";

export type ScatterPoint = {
  x: number;
  y: number;
  c: number;
};

// Same full-population projection and consensus labels used by Statistics.
export const scatter: ScatterPoint[] = analysisFlow.points.map(p => ({ x: p[0], y: p[1], c: p[5] }));

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

// Local reference copy, not photo findings. Sources and limits: docs/provenance.md.
export const CLUSTERS_META: Record<number, ClusterMeta> = {
  0: { id: 0, name: 'Keyboard', sub: 'Keyboard', n: 277, sim: .250, zs: .087, dom: 'Keyboard', pur: 89.9, lane: 'P3', hazard: null, material: 'Plastik, PCB kecil, kabel tembaga; perlu pemeriksaan fisik', action: 'Petugas terlatih memisahkan kabel, PCB, dan casing sesuai SOP fasilitas; pencacahan hanya setelah komponen yang perlu penanganan terpisah disingkirkan.' },
  1: { id: 1, name: 'Mobile', sub: 'Ponsel & tablet', n: 286, sim: .258, zs: .092, dom: 'Mobile', pur: 99.3, lane: 'P2', hazard: 'Periksa baterai tertanam; jika Li-ion, ada risiko kebakaran saat rusak atau dibongkar', material: 'PCB, tembaga, layar, dan logam bernilai pada sebagian komponen; perlu pemeriksaan fisik', action: 'Petugas terlatih memeriksa baterai dan memisahkannya sesuai SOP sebelum membongkar PCB serta modul. Kirim komponen ke pengolah yang sesuai.' },
  2: { id: 2, name: 'Washing Machine', sub: 'Mesin cuci (bukaan depan)', n: 202, sim: .262, zs: .115, dom: 'Washing Machine', pur: 99.5, lane: 'P3', hazard: null, material: 'Rangka logam, motor, dan plastik; jenis material perlu pemeriksaan fisik', action: 'Petugas terlatih memastikan jenis dan kondisi perangkat, lalu memisahkan tabung, motor, dan rangka sesuai SOP fasilitas.' },
  3: { id: 3, name: 'PCB', sub: 'Papan sirkuit (PCB)', n: 232, sim: .280, zs: .085, dom: 'PCB', pur: 97.8, lane: 'P2', hazard: null, material: 'Tembaga serta kemungkinan emas, perak, dan paladium; kandungan tidak diukur dari foto', action: 'Petugas terlatih memeriksa papan dan memisahkan komponen sesuai SOP, lalu menyerahkannya ke pengolah PCB untuk pemulihan material.' },
  4: { id: 4, name: 'Battery', sub: 'Baterai (ponsel/laptop)', n: 132, sim: .219, zs: .064, dom: 'Battery', pur: 100, lane: 'P1', hazard: 'Jika Li-ion, baterai rusak atau terminal yang korsleting dapat memicu kebakaran; kimia tidak diketahui dari foto', material: 'Bergantung kimia baterai; litium, kobalt, atau nikel pada sebagian jenis, bukan hasil deteksi', action: 'Petugas terlatih mengonfirmasi jenis, kimia, dan kondisi baterai. Jika Li-ion, lindungi terminal dengan isolasi nonkonduktif sesuai SOP; pisahkan dari jalur umum dan serahkan ke pengolah baterai. Jangan cacah di jalur umum.' },
  5: { id: 5, name: 'Washing Machine', sub: 'Mesin cuci (bukaan atas)', n: 93, sim: .234, zs: .110, dom: 'Washing Machine', pur: 100, lane: 'P3', hazard: null, material: 'Rangka logam, motor, dan plastik; jenis material perlu pemeriksaan fisik', action: 'Petugas terlatih memastikan jenis dan kondisi perangkat, lalu memisahkan tabung, motor, dan rangka sesuai SOP fasilitas.' },
  6: { id: 6, name: 'Microwave', sub: 'Microwave', n: 237, sim: .267, zs: .110, dom: 'Microwave', pur: 99.2, lane: 'P3', hazard: 'Tegangan tinggi dan muatan tersimpan dapat menyebabkan sengatan meski steker dicabut', material: 'Rangka logam, transformator, dan magnetron; perlu pemeriksaan fisik', action: 'Jangan membuka casing atau menangani kapasitor sendiri. Serahkan pemeriksaan dan pembongkaran kepada teknisi terlatih sesuai SOP fasilitas.' },
  7: { id: 7, name: 'Mouse', sub: 'Mouse', n: 266, sim: .257, zs: .054, dom: 'Mouse', pur: 98.1, lane: 'P3', hazard: null, material: 'Plastik, PCB kecil, dan kabel pada model berkabel; perlu pemeriksaan fisik', action: 'Petugas terlatih memeriksa keberadaan baterai, kabel, dan PCB, lalu memisahkannya sebelum pengolahan casing sesuai SOP fasilitas.' },
  8: { id: 8, name: 'Television', sub: 'Televisi (layar datar)', n: 133, sim: .248, zs: .099, dom: 'Television', pur: 98.5, lane: 'P3', hazard: 'Periksa lampu latar CCFL pada LCD lama; jika ada, lampu mengandung merkuri', material: 'Panel layar, PCB, dan rangka logam; perlu pemeriksaan fisik', action: 'Petugas terlatih mengonfirmasi jenis layar dan lampu latar. Pisahkan panel, lampu, dan PCB sesuai SOP tanpa memecahkan komponen yang mengandung merkuri.' },
  9: { id: 9, name: 'Mobile', sub: 'Perangkat campuran (perlu pemeriksaan)', n: 31, sim: .228, zs: .008, dom: 'Keyboard', pur: 25.8, lane: 'MR', hazard: null, material: 'Belum ditentukan; klaster acuan berisi beberapa kategori perangkat', action: 'Nama Mobile tidak mewakili isi klaster campuran. Petugas menentukan kategori, memeriksa potensi bahaya secara fisik, lalu memilih penanganan sesuai SOP.' },
  10: { id: 10, name: 'Battery', sub: 'Baterai (sel silinder & aki)', n: 80, sim: .256, zs: .102, dom: 'Battery', pur: 100, lane: 'P1', hazard: 'Kimia sel silinder belum diketahui; aki timbal-asam berisiko timbal dan elektrolit korosif', material: 'Bergantung kimia baterai; timbal hanya jika aki timbal-asam terkonfirmasi, bukan hasil deteksi foto', action: 'Petugas terlatih harus membedakan sel silinder dan aki serta mengonfirmasi kimianya secara fisik sesuai SOP. Hanya aki timbal-asam terkonfirmasi diarahkan ke pemulihan timbal; sel lain mengikuti SOP baterai yang sesuai.' },
  11: { id: 11, name: 'Mobile', sub: 'Pemutar audio (kelas Player)', n: 243, sim: .149, zs: .022, dom: 'Player', pur: 99.6, lane: 'MR', hazard: null, material: 'Plastik, PCB, dan komponen pemutar; perlu pemeriksaan fisik', action: 'Nama zero-shot Mobile bertentangan dengan kelas acuan dominan Player. Petugas mengonfirmasi kategori dan potensi bahaya secara fisik sebelum memilih penanganan sesuai SOP.' },
  12: { id: 12, name: 'Television', sub: 'Televisi (tabung CRT)', n: 174, sim: .296, zs: .085, dom: 'Television', pur: 93.7, lane: 'P1', hazard: 'Jika CRT terkonfirmasi, kaca corong dapat mengandung timbal; hindari pecah', material: 'Kaca panel dan corong, tembaga, serta baja pada perangkat CRT; perlu pemeriksaan fisik', action: 'Petugas terlatih memastikan jenis layar. Jika CRT, tangani utuh dan serahkan ke pengolah khusus; pemisahan kaca panel dan corong mengikuti SOP pengolah, bukan dilakukan berdasarkan foto.' },
  13: { id: 13, name: 'Printer', sub: 'Printer & faks', n: 274, sim: .284, zs: .101, dom: 'Printer', pur: 99.3, lane: 'P3', hazard: 'Periksa sisa toner/tinta dan keluarkan kartrid sesuai SOP', material: 'Plastik, motor, rangka logam, dan PCB; perlu pemeriksaan fisik', action: 'Petugas terlatih memisahkan kartrid toner/tinta sebelum membongkar motor, PCB, dan rangka sesuai SOP fasilitas.' }
};

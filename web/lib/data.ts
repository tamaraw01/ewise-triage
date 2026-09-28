import clustersRaw from "@/data/clusters.json";
import metaRaw from "@/data/meta.json";
import scatterRaw from "@/data/scatter.json";

export type Cluster = {
  id: number;
  label: string;
  n_images: number;
  sim_top1: number;
  label_top2: string;
  sim_top2: number;
  margin: number;
  route: string;
  handling: string;
  purity: number;
  truth_mix: Record<string, number>;
  prompt_profile: Record<string, number>;
};

export type Meta = {
  backbone: string;
  embed_dim: number;
  classes: string[];
  source_experiment: string;
  dataset_images_total: number;
  dataset_images_used: number;
  dataset_images_dropped: number;
  metrics_notebook: {
    accuracy: number;
    f1_macro: number;
    f1_weighted: number;
    ari_zeroshot: number;
    ari_cluster: number;
    silhouette_consensus: number;
    bootstrap_ari_mean: number;
    bootstrap_ari_std: number;
  };
  inference_validation: {
    n_images: number;
    n_clusters: number;
    loo_cluster_agreement: number;
    loo_label_accuracy: number;
    margin_mean: number;
    margin_p05: number;
    margin_p50: number;
  };
  review_margin_threshold: number;
  scatter_points: number;
};

export type ScatterPoint = { x: number; y: number; c: number; f: string; t: string };

export const clusters = clustersRaw as unknown as Cluster[];
export const meta = metaRaw as unknown as Meta;
export const scatter = scatterRaw as unknown as ScatterPoint[];

/** Lima jalur penanganan. Hanya HAZARD memakai aksen, karena hanya itu
 *  yang berkonsekuensi keselamatan (lihat DESIGN.md). */
export const ROUTES: Record<string, { name: string; note: string; accent: boolean }> = {
  BOARD: {
    name: "Papan & modul",
    note: "Pembongkaran untuk pemulihan papan sirkuit dan modul",
    accent: false,
  },
  HAZARD: {
    name: "Bahan berbahaya",
    note: "Penanganan sel baterai terpisah, jangan ditekan atau dilubangi",
    accent: true,
  },
  DISPLAY: {
    name: "Panel tampilan",
    note: "Layar dipisahkan sebelum rangka masuk jalur logam",
    accent: false,
  },
  APPLIANCE: {
    name: "Peralatan besar",
    note: "Rangka logam, motor, dan trafo dipisah secara mekanik",
    accent: false,
  },
  BULK: {
    name: "Curah & periferal",
    note: "Pemisahan plastik, membran, dan modul kecil",
    accent: false,
  },
  MANUAL_REVIEW: {
    name: "Tinjauan petugas",
    note: "Keyakinan di bawah ambang, keputusan diserahkan ke petugas",
    accent: true,
  },
};

export const percent = (v: number) => `${(v * 100).toFixed(2)}%`;
export const fixed4 = (v: number) => v.toFixed(4);

/** Klaster yang label zero-shot-nya tidak cocok isi sebenarnya.
 *  Ditampilkan terbuka, bukan disembunyikan (DESIGN.md, aturan kejujuran). */
export const isContested = (c: Cluster) => c.purity < 0.5;

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "";

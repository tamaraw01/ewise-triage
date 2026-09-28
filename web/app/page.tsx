import SiteNav from "@/components/SiteNav";
import TriagePanel from "@/components/TriagePanel";
import ClusterMap from "@/components/ClusterMap";
import ClusterTable from "@/components/ClusterTable";
import { SectionHead, TickRule } from "@/components/Primitives";
import { clusters, meta } from "@/lib/data";

export default function Home() {
  const m = meta.metrics_notebook;
  const v = meta.inference_validation;

  return (
    <>
      <SiteNav />

      <main id="konten">
        {/* Pembuka: satu kolom keputusan, bukan hero pemasaran. */}
        <section className="border-b border-edge">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <TickRule count={30} className="mb-6" />
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.15] sm:text-5xl">
              Konsol triase citra limbah elektronik
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-bone-dim sm:text-base">
              Satu foto barang elektronik dipetakan ke salah satu dari {v.n_clusters} klaster yang
              ditemukan dari {meta.dataset_images_used.toLocaleString("id-ID")} citra dataset BDC
              2026, lalu dikembalikan sebagai jalur penanganan. Bila margin keyakinan di bawah
              ambang, konsol menolak memberi label dan menyerahkan keputusan ke petugas.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-px border border-edge bg-edge sm:grid-cols-4">
              <Stat k="Klaster" v={String(v.n_clusters)} note="konsensus co-association" />
              <Stat k="Citra acuan" v={meta.dataset_images_used.toLocaleString("id-ID")} note={`dari ${meta.dataset_images_total.toLocaleString("id-ID")} citra`} />
              <Stat k="Akurasi label" v={`${(m.accuracy * 100).toFixed(2)}%`} note="terhadap label berkas" />
              <Stat k="Ambang margin" v={meta.review_margin_threshold.toFixed(4)} note="persentil 5 leave-one-out" />
            </dl>
          </div>
        </section>

        {/* Triase: komposisi dua kolom, fokus pada batang margin. */}
        <section id="triase" className="border-b border-edge scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <SectionHead
              index="01"
              title="Triase satu citra"
              lead="Citra dikirim ke backend inference, diubah menjadi vektor CLIP ViT-H/14, lalu dibandingkan ke centroid setiap klaster memakai cosine similarity."
            />
            <TriagePanel />
          </div>
        </section>

        {/* Peta: bidang lebar. */}
        <section id="peta" className="border-b border-edge scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <SectionHead
              index="02"
              title="Peta sebaran klaster"
              lead={`Proyeksi UMAP dua dimensi dari ${meta.scatter_points.toLocaleString("id-ID")} citra contoh. Proyeksi ini untuk dibaca mata; pengelompokan sendiri dikerjakan di ruang 50 dimensi.`}
            />
            <ClusterMap />
          </div>
        </section>

        {/* Tabel: daftar padat. */}
        <section id="klaster" className="border-b border-edge scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <SectionHead
              index="03"
              title="Empat belas klaster dan jalurnya"
              lead="Kolom margin memisahkan klaster yang bisa dipercaya dari yang tidak. Urutkan menurut kolom mana pun."
            />
            <ClusterTable />
          </div>
        </section>

        {/* Metode: rantai proses. */}
        <section id="metode" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <SectionHead
              index="04"
              title="Rantai proses dan angkanya"
              lead={meta.source_experiment}
            />

            <ol className="grid gap-px border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-3">
              <Step n="1" t="Penyaringan masukan" d={`${meta.dataset_images_total.toLocaleString("id-ID")} citra disaring menurut prefix nama berkas ke sepuluh kelas. ${meta.dataset_images_dropped.toLocaleString("id-ID")} citra di luar daftar dibuang.`} />
              <Step n="2" t="Representasi visual" d={`${meta.backbone} menghasilkan vektor ${meta.embed_dim} dimensi tanpa label, lalu dinormalisasi L2 agar jarak Euclidean setara jarak kosinus.`} />
              <Step n="3" t="Reduksi manifold" d="UMAP 50 dimensi (metrik kosinus) sebagai ruang pengelompokan, UMAP 2 dimensi hanya untuk visualisasi." />
              <Step n="4" t="Konsensus tiga metode" d="K-Means (K=9) dan Ward (K=9) dipilih dengan silhouette, GMM (K=14) dengan BIC. Matriks co-association tiga partisi dipotong menjadi 14 klaster final." />
              <Step n="5" t="Pelabelan zero-shot" d="Sepuluh prompt teks diencode, cosine similarity dihitung per citra lalu dirata-rata per klaster. Prompt tertinggi menjadi label klaster." />
              <Step n="6" t="Putusan produksi" d={`Citra baru dibandingkan ke centroid klaster. Margin di bawah ${meta.review_margin_threshold.toFixed(4)} dikembalikan tanpa label.`} />
            </ol>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="border border-edge bg-iron p-5">
                <h3 className="text-sm font-semibold tracking-wide">Metrik notebook EXP 14</h3>
                <p className="mt-2 text-xs leading-relaxed text-bone-dim">
                  Dihitung pada {meta.dataset_images_used.toLocaleString("id-ID")} citra, dengan label
                  berkas yang disimpan terpisah dan tidak ikut dalam pengelompokan.
                </p>
                <dl className="mt-4 space-y-2 text-xs">
                  <Metric k="Akurasi" v={`${(m.accuracy * 100).toFixed(2)}%`} />
                  <Metric k="F1 makro" v={m.f1_macro.toFixed(4)} />
                  <Metric k="F1 terbobot" v={m.f1_weighted.toFixed(4)} />
                  <Metric k="ARI label zero-shot" v={m.ari_zeroshot.toFixed(4)} />
                  <Metric k="ARI klaster final" v={m.ari_cluster.toFixed(4)} />
                  <Metric k="Silhouette konsensus" v={m.silhouette_consensus.toFixed(4)} />
                  <Metric k="Bootstrap ARI (50x)" v={`${m.bootstrap_ari_mean.toFixed(4)} \u00b1 ${m.bootstrap_ari_std.toFixed(4)}`} />
                </dl>
              </div>

              <div className="border border-edge bg-iron p-5">
                <h3 className="text-sm font-semibold tracking-wide">Validasi metode inference</h3>
                <p className="mt-2 text-xs leading-relaxed text-bone-dim">
                  Diuji leave-one-out: centroid dihitung ulang tanpa citra yang sedang diuji, lalu
                  citra itu diklasifikasi memakai jalur produksi yang sama. Ini mengukur pencocokan
                  centroid, bukan mengulang pengelompokan.
                </p>
                <dl className="mt-4 space-y-2 text-xs">
                  <Metric k="Kesepakatan klaster" v={`${(v.loo_cluster_agreement * 100).toFixed(2)}%`} />
                  <Metric k="Akurasi label" v={`${(v.loo_label_accuracy * 100).toFixed(2)}%`} />
                  <Metric k="Margin rata-rata" v={v.margin_mean.toFixed(4)} />
                  <Metric k="Margin median" v={v.margin_p50.toFixed(4)} />
                  <Metric k="Margin persentil 5" v={v.margin_p05.toFixed(4)} />
                  <Metric k="Citra diuji" v={v.n_images.toLocaleString("id-ID")} />
                </dl>
              </div>
            </div>

            <div className="mt-8 border-l-2 border-amber bg-iron px-4 py-4">
              <h3 className="text-sm font-semibold tracking-wide">Batas penafsiran</h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-bone-dim">
                <li>
                  Label adalah dugaan taksonomis dari kedekatan visual citra, bukan hasil pemeriksaan
                  isi fisik barang. Konsol ini tidak membuka dan tidak menimbang apa pun.
                </li>
                <li>
                  Angka akurasi berlaku pada dataset acuan. Citra dari kondisi lapangan yang berbeda
                  (cahaya, sudut, barang tertimbun) belum diuji di sini.
                </li>
                <li>
                  {clusters.filter((c) => c.purity < 0.5).length} klaster tercatat terbantah: label
                  zero-shot-nya tidak mewakili isi mayoritas. Keduanya dibiarkan tampil agar
                  keterbatasan metode terlihat.
                </li>
                <li>
                  Jalur penanganan adalah pemetaan taksonomis dari label kelas, bukan rekomendasi
                  kepatuhan regulasi.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-edge">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-relaxed text-bone-dim">
            E-WISE Triage. Dibangun dari artefak notebook EXP 14, Big Data Challenge Satria Data 2026.
          </p>
          <p className="num text-[11px] text-bone-dim">{meta.backbone}</p>
        </div>
      </footer>
    </>
  );
}

function Stat({ k, v, note }: { k: string; v: string; note: string }) {
  return (
    <div className="bg-iron px-4 py-4">
      <dt className="text-[11px] uppercase tracking-wider text-bone-dim">{k}</dt>
      <dd className="num mt-1.5 text-2xl font-semibold">{v}</dd>
      <p className="mt-1 text-[11px] leading-snug text-bone-dim">{note}</p>
    </div>
  );
}

function Step({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <li className="bg-iron px-5 py-5">
      <span className="num text-xs font-semibold text-amber">{n}</span>
      <h3 className="mt-2 text-sm font-semibold leading-snug">{t}</h3>
      <p className="mt-2 text-xs leading-relaxed text-bone-dim">{d}</p>
    </li>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-2 last:border-0">
      <dt className="text-bone-dim">{k}</dt>
      <dd className="num font-semibold">{v}</dd>
    </div>
  );
}

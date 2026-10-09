import Link from "next/link";

export default function Page() {
  return (
    <main id="konten" className="landing">
      <header className="landing-nav">
        <Link href="/" className="wordmark" aria-label="E-WISE beranda">E-WISE</Link>
        <nav aria-label="Navigasi utama">
          <a href="#pendekatan">Pendekatan</a>
          <Link href="/dashboard" className="nav-dashboard">Buka dashboard</Link>
        </nav>
      </header>

      <section className="recovery-hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Akhir pakai.<br /><span>Bukan akhir nilai.</span></h1>
        <div className="hero-bottom">
          <div className="hero-copy">
            <p>Kenali limbah elektronik dari satu foto. Tentukan jalur penanganannya, dengan batas keyakinan yang terbuka.</p>
            <Link className="landing-cta" href="/dashboard">Mulai triase foto <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7" /></svg></Link>
            <p className="hero-note">Alat bantu pemilahan. Bukan pengganti pemeriksaan fisik.</p>
          </div>
          <figure className="material-study">
            <svg className="recovery-art" viewBox="0 0 720 520" role="img" aria-labelledby="art-title art-desc">
              <title id="art-title">Rangkaian elektronik dalam siklus material</title>
              <desc id="art-desc">Ilustrasi papan sirkuit terurai, chip, konektor, dan jalur melingkar. Bukan hasil analisis barang.</desc>
              <g className="recovery-loop" fill="none" stroke="#9fb78d" strokeWidth="1.5">
                <ellipse cx="370" cy="286" rx="300" ry="180" transform="rotate(-22 370 286)" />
                <path d="m110 149 7 32 33-5M638 357l-1-34-33-2" strokeWidth="4" />
                <ellipse cx="370" cy="286" rx="269" ry="150" transform="rotate(-22 370 286)" strokeDasharray="3 10" />
              </g>
              <g className="board-base" strokeLinejoin="round">
                <path d="M180 275 432 151 617 274 361 419Z" fill="#263e32" stroke="#9fb78d" strokeWidth="2" />
                <path d="m180 275 181 144 256-145v21L361 442 180 296Z" fill="#17251d" stroke="#71866a" />
                <g fill="none" stroke="#a9bd91" strokeWidth="2">
                  <path d="m206 278 72-35 51 34 62-31 54 36 101-54M227 299l44-22 66 46 60-32 45 29 67-37M250 319l44-22 45 34-39 24M330 387l42-23 39 25M429 363l-34-24 82-43M486 240l-55-37-69 36M283 239l52-26 42 29" />
                  <circle cx="206" cy="278" r="4" /><circle cx="546" cy="228" r="4" /><circle cx="330" cy="387" r="4" /><circle cx="429" cy="363" r="4" />
                </g>
                <g fill="#c4cbb0" stroke="#17251d" strokeWidth="2">
                  <path d="m231 289 32-16 26 18-32 16Z" /><path d="m470 322 48-25 20 13-48 26Z" />
                  <path d="m330 379 40-21 14 10-40 21Z" /><path d="m487 250 33-17 19 12-33 18Z" />
                </g>
              </g>
              <g className="board-chip">
                <path d="m289 220 119-59 96 64-119 64Z" fill="#111b16" stroke="#d9dfc9" strokeWidth="2" />
                <path d="m289 220 96 69 119-64v20l-119 63-96-68Z" fill="#263a2d" stroke="#8c9f7c" />
                <path d="m317 220 89-43 69 47-89 46Z" fill="#9fb78d" />
                <g stroke="#c4cbb0" strokeWidth="6">
                  <path d="m308 247-19 10m34 1-19 10m34 1-19 10m35 1-19 10m80-4 13 10m4-20 13 10m4-20 13 10m4-20 13 10" />
                </g>
                <path d="m354 221 33-17 33 22-33 17Z" fill="#263e32" />
              </g>
              <g className="board-parts" stroke="#b8c7a5" strokeWidth="1.5">
                <path d="m158 183 65-32 34 23-65 33Z" fill="#c4cbb0" /><path d="m158 183 34 24 65-33v29l-65 34-34-25Z" fill="#344b3b" />
                <path d="m493 130 39-19 39 26-40 20Z" fill="#9fb78d" /><path d="m493 130 38 27 40-20v43l-40 21-38-28Z" fill="#344b3b" />
                <path d="m199 380 48-24 35 23-48 25Z" fill="#a9bd91" /><path d="m199 380 35 24 48-25v17l-48 25-35-26Z" fill="#263e32" />
              </g>
              <g fill="#d9dfc9" fontSize="12">
                <path d="M187 201H80v-42M530 144h88v-45M444 374h173v57" fill="none" stroke="#8c9f7c" />
                <text x="80" y="148">KONEKTOR</text><text x="572" y="88">KOMPONEN</text><text x="550" y="451">PAPAN SIRKUIT</text>
              </g>
            </svg>
            <figcaption>Material masih bernilai. Penanganannya perlu tepat.</figcaption>
          </figure>
        </div>
        <div className="hero-foot"><span>Triase visual limbah elektronik</span><span>Kenali · Pilah · Tinjau</span></div>
      </section>

      <section id="pendekatan" className="approach" aria-labelledby="approach-title">
        <h2 id="approach-title">Pisahkan material.<br />Jangan abaikan risiko.</h2>
        <div className="approach-body">
          <p>Foto membantu mengenali kemiripan visual. E-WISE mencocokkannya dengan klaster riset, lalu menampilkan jalur penanganan dan margin keyakinan.</p>
          <div className="approach-rule"><h3>Ragu berarti tinjau.</h3><p>Margin rendah dan klaster dengan penamaan bermasalah masuk peninjauan manual. Bukan dipaksa menjadi jawaban.</p></div>
          <div className="safety-line"><span aria-hidden="true">!</span><p>Baterai dan komponen berbahaya memerlukan SOP khusus. Jangan bongkar barang hanya berdasarkan foto.</p></div>
          <Link className="text-link" href="/dashboard">Periksa foto atau telusuri klaster</Link>
        </div>
      </section>
      <footer className="landing-footer"><span className="wordmark">E-WISE</span><p>Kenali barangnya. Pertimbangkan risikonya.</p><Link href="/dashboard">Dashboard triase</Link></footer>
    </main>
  );
}

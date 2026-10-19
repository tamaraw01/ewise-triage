# E-WISE — evidence for handling copy

Research date: 2026-10-19. Research only; no code, routing, or deployment changed.

## Decision boundary

**Foto membantu triase, bukan memastikan bahan, kimia baterai, jenis layar, atau keamanan perangkat. Petugas memeriksa kondisi fisik dan mengikuti SOP fasilitas.** No percentage, metal yield, resale value, or absolute safety claim follows from cluster membership. P1/P2/P3 are local handling labels, not certified hazard classes. Empty hazard text must mean “not assessed”, never “no hazard”.

Recommendations below are conservative operational judgments informed by cited sources, not verbatim legal instructions. All battery removal, display treatment, and internal dismantling belong to competent staff and appropriate facilities. Do not publish capacitor-discharge, CRT-breaking, battery-opening, or chemical metal-extraction instructions.

## Proposed short Indonesian copy, all 14 clusters

Shared material fallback: **“Material belum dipastikan; perlu pemeriksaan fisik.”** This is deliberate: bounded source set does not establish category-specific composition for keyboard, mouse, washing machine, audio player, or printer. Do not preserve a material list merely because it sounds plausible.

| Cluster | Material copy | Hazard copy | Action copy | Exact support / limit |
|---|---|---|---|---|
| C0 Keyboard | Material belum dipastikan; perlu pemeriksaan fisik. | Periksa baterai jika ada. | Petugas memeriksa baterai dan kabel sebelum pengolahan sesuai SOP. | [1] Annex VII: batteries and external cables. Conditional inspection; no claim every keyboard has either. Small PCB removal is not universally required by Annex VII. |
| C1 Mobile / tablet | Potensi logam bernilai pada ponsel; kandungan unit belum diukur. | Periksa baterai tertanam; Li-ion rusak dapat memicu kebakaran. | Petugas memeriksa baterai dan jenis perangkat sebelum pemisahan komponen sesuai SOP. | [1] mobile-phone boards and batteries; [2] Li-ion handling. [5] supports historical phones only, not all tablets or every unit. Use material fallback if UI cannot retain this distinction. |
| C2 Mesin cuci | Material belum dipastikan; perlu pemeriksaan fisik. | Bahaya listrik dan komponen internal perlu diperiksa. | Petugas memeriksa kondisi dan komponen sebelum pembongkaran sesuai SOP. | [1] selective treatment, including qualifying capacitors and boards; [6] SOP. No evidence here for concrete ballast, copper motor winding, exact steel/plastic mix, or front-loading subtype. Hazard wording is precaution, not detected fault. |
| C3 PCB | Potensi pemulihan material; kandungan logam belum diukur. | Periksa komponen yang perlu penanganan terpisah. | Serahkan papan sirkuit ke pengolah kompeten; pemisahan mengikuti SOP. | [1] mobile-phone boards generally; other boards only above specified area. [5] phone metals cannot establish assay of arbitrary PCB. Omit gold/silver/palladium list for generic board unless separately sourced. |
| C4 Baterai | Bergantung kimia; belum dipastikan. | Kimia belum diketahui; jika Li-ion, ada risiko kebakaran. | Konfirmasi jenis dan kondisi. Pisahkan dari jalur umum dan serahkan ke pengelola baterai yang sesuai. | [1] separate batteries; [2] Li-ion-specific handling. Shape/photo does not establish Li-ion or lithium/cobalt/nickel content. Terminal protection applies to confirmed Li-ion, subject to condition and SOP, not automatic handling of damaged unknown cells. |
| C5 Mesin cuci | Material belum dipastikan; perlu pemeriksaan fisik. | Bahaya listrik dan komponen internal perlu diperiksa. | Petugas memeriksa kondisi dan komponen sebelum pembongkaran sesuai SOP. | Same as C2. Do not claim top-loading subtype from cluster. |
| C6 Microwave | Material belum dipastikan; perlu pemeriksaan fisik. | Risiko sengatan tetap ada meski steker dicabut. | Jangan buka casing sendiri. Serahkan pemeriksaan internal kepada teknisi kompeten. | [3] exact high-voltage and unplugged-shock warning. No unsupported transformer/magnetron inventory or claim capacitor always retains charge. |
| C7 Mouse | Material belum dipastikan; perlu pemeriksaan fisik. | Periksa baterai jika ada. | Petugas memeriksa baterai dan kabel sebelum pengolahan sesuai SOP. | [1] batteries and external cables; conditional, not a claim mouse is wireless/wired. No universal board-area assertion. |
| C8 Televisi — jenis layar belum pasti | Jenis layar dan material belum dipastikan. | Jika memakai lampu bermerkuri, perlu penanganan khusus. | Konfirmasi jenis layar. Serahkan lampu dan panel yang memerlukan perlakuan khusus ke pengolah kompeten. | [1] mercury-bearing backlighting, specified LCDs and gas-discharge lamps. Cluster does not establish flat panel, LCD, CCFL, LED, OLED, or mercury presence. Not all flat panels contain mercury. |
| C9 Campuran / tinjau manual | Material belum ditentukan. | Bahaya belum dinilai. | Petugas mengonfirmasi kategori dan kondisi sebelum menentukan penanganan. | Local provenance establishes mixed reference class, not composition; [6] SOP/recordkeeping supports operational control. No source can turn mixed cluster into reliable device identity. |
| C10 Baterai / sel dan aki belum dikonfirmasi | Bergantung kimia; belum dipastikan. | Kimia dan kondisi belum diketahui. | Konfirmasi jenis baterai. Jangan tentukan jalur pemulihan timbal sebelum kimia terverifikasi. | [1], [2]. Neither cylinder shape nor label cluster proves lead-acid. No assertion all cells contain lithium, cobalt, nickel, or lead. This row deliberately avoids unsourced lead-acid chemical detail. |
| C11 Pemutar audio / tinjau manual | Material belum dipastikan; perlu pemeriksaan fisik. | Periksa baterai jika ada. | Konfirmasi kategori dan baterai sebelum memilih penanganan sesuai SOP. | Local provenance: Mobile name conflicts with Player reference class. [1] batteries; [2] conditional Li-ion control only after confirmation. No phone-metal inference for audio players. |
| C12 Televisi — periksa kemungkinan CRT | Jika CRT terkonfirmasi, kaca memerlukan penilaian khusus. | Jika CRT, kandungan timbal berbeda antarbagian kaca. | Konfirmasi jenis layar. Hindari memecahkan CRT; serahkan ke pengolah kompeten. | [4] panel/funnel/frit distinction; [1] CRT separate treatment and fluorescent-coating removal. Intact handling is precaution, not claim EPA forbids every breakage. Cluster does not prove CRT. |
| C13 Printer / faks | Material belum dipastikan; perlu pemeriksaan fisik. | Periksa sisa toner atau tinta. | Petugas memisahkan kartrid sebelum pengolahan perangkat sesuai SOP. | [1] toner cartridges including liquid/paste/colour toner; does not establish all ink chemistry, all cartridges hazardous, or device-specific motor/plastic composition. Treat generic “tinta” as inspection precaution; source directly mandates toner separation. |

## Evidence excerpts and citation ledger

Companion ledger: `handling-evidence-2026-10-19.sources.json`. Quotes saved there were checked against evidence files with `sources.py quote`. Sources below are primary government/legal publications. Fresh retrieval and existing saved originals are distinguished; search snippets were not treated as evidence.

### [1] EU WEEE, Directive 2012/19/EU, Article 8 and Annex VII

URL: <https://eur-lex.europa.eu/eli/dir/2012/19/oj>

Actual evidence read: existing `research/src/weee.txt`, full Annex VII passage. Fresh EUR-Lex extraction was incomplete, so it was not relied on for missing Annex text. EU treatment requirements are technical reference, **not Indonesian law**.

- Annex VII(1): “As a minimum the following substances, mixtures and components have to be removed from any separately collected WEEE”.
- “mercury containing components, such as switches or backlighting lamps,”
- “batteries,”
- “printed circuit boards of mobile phones generally, and of other devices if the surface of the printed circuit board is greater than 10 square centimetres,”
- “toner cartridges, liquid and paste, as well as colour toner,”
- “plastic containing brominated flame retardants,”
- “cathode ray tubes,”
- “liquid crystal displays (together with their casing where appropriate) of a surface greater than 100 square centimetres and all those back-lighted with gas discharge lamps,”
- “external electric cables,”
- “electrolyte capacitors containing substances of concern (height > 25 mm, diameter > 25 mm or proportionately similar volume).” (Whitespace normalized here.)
- Annex VII(2): “cathode ray tubes: the fluorescent coating has to be removed,” and “gas discharge lamps: the mercury shall be removed.”

Interpretation: identify and separately manage applicable components before ordinary material processing. This is not permission for untrained dismantling. Printed circuit board (PCB) is not the same meaning as polychlorinated biphenyl (also abbreviated PCB in Annex VII). No inference that all plastics contain brominated flame retardants or every small board meets threshold.

### [2] US EPA, Used Lithium-Ion Batteries

URL: <https://www.epa.gov/recycle/used-lithium-ion-batteries>

Fresh page extraction read on research date. Saved extracted text during research: `/tmp/ewise_ev/s2.txt`; relevant excerpt retained in companion ledger.

- “To prevent fires, tape battery terminals and/or place lithium-ion batteries in separate plastic bags.”
- “Some Li-ion batteries can be removed easily from the products they power, others cannot.”
- Page lists phones, laptops, tablets and e-readers among common applications.

Interpretation: Li-ion-specific short-circuit prevention, not a chemical identification method. Do not force embedded batteries out or prescribe ordinary bagging as emergency treatment for hot, leaking, swollen, damaged, or unidentified batteries. Escalate such conditions to facility-specific emergency SOP and competent personnel. No universal “fireproof vessel” claim supported here. US disposal/shipping rules do not replace Indonesian requirements.

### [3] US CPSC, Publication 5061, Electrocution Hazard with Do-It-Yourself Repairs of Microwave Ovens

URL: <https://www.cpsc.gov/s3fs-public/micro.pdf>

Actual evidence read: existing original-derived `research/src/cpsc_micro.txt`, publication dated 02/2012.

> “Microwave ovens use high voltage which makes it particularly hazardous for consumers to remove the cover and touch electrical parts. The possibility for electrical shock from a microwave oven still exists even after the oven is disconnected from the power source.”

> “The Commission strongly recommends that consumers have professionals repair microwave ovens”.

Interpretation: retain high-voltage warning and professional handoff. No discharge instructions. Manufacturer-specific warning was not verified in bounded research; CPSC provides direct authoritative support instead. Do not claim removal of plug makes internal work safe.

### [4] US EPA, Frequent Questions About the Regulation of Used CRTs and CRT Glass, question 22

URL: <https://www.epa.gov/hw/frequent-questions-about-regulation-used-cathode-ray-tubes-crts-and-crt-glass>

Actual evidence read: existing `research/src/epa_crt.txt` and full saved `epa_crt.html`; canonical URL confirmed in HTML. An initially attempted alternate EPA URL failed; it was not used as evidence.

> “CRT processed glass is glass that has been broken and sorted into the different glass portions of the CRT (panel, funnel, and frit line) which are classified according to chemical composition, especially by the amount of lead contained.”

> “CRT processed glass that does fail the toxicity characteristic for hazardous waste (which generally includes funnel glass and frit line material)”.

EPA contrasts that with glass not failing toxicity characteristic, “which generally includes panel glass”.

Interpretation: do not call all CRT glass equally leaded or harmless. Confirm screen construction; specialist assessment and treatment. US RCRA classification and exclusions are not Indonesian legal classifications.

### [5] USGS, Recycled Cell Phones—A Treasure Trove of Valuable Metals, Fact Sheet 2006-3097

URL: <https://pubs.usgs.gov/fs/2006/3097/fs2006-3097.pdf>

Fresh PDF extraction read on research date; excerpt retained in ledger. Historical evidence for phones, not current assay or tablet/generic-board inventory.

> “This USGS Fact Sheet examines the potential value of recycling the metals found in obsolete cell phones.”

Section “Metal Contents in Cell Phones” identifies copper, silver, gold and palladium, among other metals; quantitative table is a historical industry-average estimate excluding batteries, not this project's units. No numbers from that table should enter UI. Its “gross values do not include costs of recycling”.

Interpretation: category-level potential metal recovery exists for phones; amount, purity, feasibility and net value require characterization and processor assessment. This source does not validate precious metals in every keyboard, mouse, tablet or photographed PCB. Bounded document therefore removes those claims rather than transferring phone composition to unrelated categories.

### [6] Indonesia, Permen LHK No. 9 Tahun 2024

Title: Pengelolaan Sampah yang Mengandung Bahan Berbahaya dan Beracun dan Limbah Bahan Berbahaya dan Beracun.

Official-host PDF: <https://peraturan.bpk.go.id/Download/351283/Permen%20LHK%20No%209%20Tahun%202024.pdf>

Actual evidence read: existing original-derived `research/src/permenlhk9_2024.txt`. No fresh consolidated legal-status verification; do not present this research as a complete current compliance opinion.

- Pasal 3(2)(c): “barang elektronik yang tidak digunakan lagi”.
- Pasal 3(4) distinguishes this stream from “sisa hasil usaha dan/atau kegiatan yang mengandung B3”. This prevents conflating all household specific waste with every industrial hazardous-waste stream.
- Pasal 24(1)(b): “memiliki prosedur operasional standar”.
- Pasal 24(3)(e): records include material handed to “usaha dan/atau kegiatan yang memiliki perizinan berusaha di bidang Pengelolaan Limbah B3.”
- Pasal 24(5) requires records whenever collected, processed and/or handed over to such licensed businesses/activities.

Operational recommendation: verify recipient's current authorization and relevant accepted waste/treatment scope with competent Indonesian authority (e.g. local DLH), personnel competence, suitable battery/display/toner capability, and handover records. This verification checklist is recommendation, not quotation of a universal permit formula. “Certified recycler” or foreign R2/e-Stewards certification alone is not evidence of Indonesian authorization. No named processor vetted here.

Related background actually read: existing `research/src/pp27.txt`, PP 27/2020 Pasal 5(2)(c), “barang elektronik yang tidak digunakan lagi”; official record <https://peraturan.go.id/id/pp-no-27-tahun-2020>. OCR renders B3 as “83” in places, so do not copy OCR errors into UI. Existing `research/cluster_sources.md` warns downloaded `pp22.txt` is wrong document: **PP 22/2021 waste codes and Permen LHK 6/2021 requirements remain unverified here; do not cite that local file or assign B107d from this research.**

## Integration checks

- Keep category names conditional where source metadata lacks per-image subtype verification; especially C2/C5 and C8/C12.
- Preserve manual review for C9/C11 based on `docs/provenance.md`, not external safety sources.
- Global short copy can carry inspection/SOP caveat once; retain battery, microwave and display-specific warning in each relevant detail panel.
- No claim these sources make work absolutely safe; no photo-based chemical detection, metal assay, yield estimate, or licensing certification.
- Material fallback is preferred over unsourced plastic/motor/copper/concrete/magnetron inventories.
- Scope complete: C0–C13 mapped above. No code modified by this research task.

## Sources

[1] https://eur-lex.europa.eu/eli/dir/2012/19/oj — WEEE Annex VII
[2] https://www.epa.gov/recycle/used-lithium-ion-batteries — EPA Used Lithium-Ion Batteries
[3] https://www.cpsc.gov/s3fs-public/micro.pdf — CPSC Microwave electrocution warning
[4] https://www.epa.gov/hw/frequent-questions-about-regulation-used-cathode-ray-tubes-crts-and-crt-glass — EPA CRT FAQ
[5] https://pubs.usgs.gov/fs/2006/3097/fs2006-3097.pdf — USGS Recycled Cell Phones
[6] https://peraturan.bpk.go.id/Download/351283/Permen%20LHK%20No%209%20Tahun%202024.pdf — Permen LHK 9/2024

Verification note: ledger checker validates source IDs/URLs and saved quote presence, not semantic truth or completeness of legal review. Claim-to-excerpt mapping is the per-cluster table above.

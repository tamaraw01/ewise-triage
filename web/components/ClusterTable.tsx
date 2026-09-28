"use client";

import { useState } from "react";
import { clusters, meta, ROUTES, isContested } from "@/lib/data";
import { RouteTag } from "./Primitives";

type SortKey = "id" | "n_images" | "margin" | "purity";

export default function ClusterTable() {
  const [sort, setSort] = useState<SortKey>("id");
  const [desc, setDesc] = useState(false);

  const rows = [...clusters].sort((a, b) => {
    const d = a[sort] - b[sort];
    return desc ? -d : d;
  });

  const head = (key: SortKey, label: string, align = "text-left") => (
    <th scope="col" className={`${align} px-3 py-2.5`}>
      <button
        type="button"
        onClick={() => {
          if (sort === key) setDesc(!desc);
          else {
            setSort(key);
            setDesc(false);
          }
        }}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-amber"
        aria-label={`Urutkan menurut ${label}`}
      >
        {label}
        <span className="num text-amber" aria-hidden="true">
          {sort === key ? (desc ? "\u25bc" : "\u25b2") : ""}
        </span>
      </button>
    </th>
  );

  const contestedCount = clusters.filter(isContested).length;

  return (
    <div>
      <div className="overflow-x-auto border border-edge bg-iron">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">
            Empat belas klaster hasil EXP 14 dengan jumlah citra, skor, margin, kemurnian, dan jalur penanganan
          </caption>
          <thead className="border-b border-edge bg-iron-hi text-bone-dim">
            <tr>
              {head("id", "Kode")}
              <th scope="col" className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                Label zero-shot
              </th>
              {head("n_images", "Citra", "text-right")}
              {head("margin", "Margin", "text-right")}
              {head("purity", "Kemurnian", "text-right")}
              <th scope="col" className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                Jalur
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const bad = isContested(c);
              const route = ROUTES[c.route];
              return (
                <tr key={c.id} className="border-b border-edge/60 last:border-0">
                  <td className="num px-3 py-2.5 font-semibold">C{c.id}</td>
                  <td className="px-3 py-2.5">
                    <span className={bad ? "text-bone-dim line-through" : ""}>{c.label}</span>
                    {bad ? (
                      <span className="num ml-2 border border-amber px-1.5 py-0.5 text-[10px] font-semibold text-amber">
                        TERBANTAH
                      </span>
                    ) : null}
                  </td>
                  <td className="num px-3 py-2.5 text-right">{c.n_images}</td>
                  <td className="num px-3 py-2.5 text-right">{c.margin.toFixed(4)}</td>
                  <td className="num px-3 py-2.5 text-right">
                    <span className={bad ? "text-amber" : ""}>{(c.purity * 100).toFixed(1)}%</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <RouteTag code={c.route} accent={route?.accent ?? false} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-l-2 border-amber bg-iron px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide">
          {contestedCount} dari {clusters.length} klaster tercatat terbantah
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-bone-dim">
          C11 diberi label Mobile oleh CLIP, tetapi 242 dari 243 citranya sebenarnya Player. C9
          punya margin {clusters.find((c) => c.id === 9)?.margin.toFixed(4)}, hampir tidak
          memisahkan pilihan pertama dari kedua, dan isinya campuran empat kelas. Dua kasus ini
          ditampilkan apa adanya karena keduanya menjelaskan mengapa ambang margin{" "}
          <span className="num">{meta.review_margin_threshold.toFixed(4)}</span> diperlukan: hasil
          di bawahnya dikembalikan tanpa label, bukan sebagai tebakan.
        </p>
      </div>
    </div>
  );
}

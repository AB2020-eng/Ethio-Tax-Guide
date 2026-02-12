"use client";

import { useState } from "react";

type TaxCalcResponse = {
  estimated_tax: number;
  explanation: string;
};

export default function SoleProprietorSection({
  onResult,
}: {
  onResult: (res: TaxCalcResponse) => void;
}) {
  const [revenue, setRevenue] = useState("");
  const [salaries, setSalaries] = useState("");
  const [rent, setRent] = useState("");
  const [materials, setMaterials] = useState("");
  const [depreciation, setDepreciation] = useState("");
  const [interest, setInterest] = useState("");
  const [charity, setCharity] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  const calculate = () => {
    if (isCalculating) return;
    setIsCalculating(true);
    const rev = Number(revenue || 0);
    const sal = Number(salaries || 0);
    const rnt = Number(rent || 0);
    const mat = Number(materials || 0);
    const dep = Number(depreciation || 0);
    const intv = Number(interest || 0);
    const chr = Number(charity || 0);
    const other = sal + rnt + mat + dep + intv;
    const pre = Math.max(rev - other, 0);
    const cap = pre * 0.10;
    const chUsed = Math.min(chr, cap);
    const taxable = Math.max(pre - chUsed, 0);
    const brackets: Array<[number, number]> = [
      [24000, 0.0],
      [48000, 0.15],
      [84000, 0.20],
      [120000, 0.25],
      [168000, 0.30],
      [Number.POSITIVE_INFINITY, 0.35],
    ];
    let rate = 0,
      upper = 0;
    for (const [ub, r] of brackets) {
      upper = ub;
      if (taxable <= ub) {
        rate = r;
        break;
      }
    }
    const estimated = Math.max(taxable * rate, 0);
    const matTax = rev * 0.025;
    const finalTax = Math.max(estimated, matTax);
    const explanation =
      "Annual Sole Proprietor Tax:\n" +
      "| Item | Amount |\n" +
      "|---|---|\n" +
      `| Annual Revenue | ${rev.toFixed(2)} ETB |\n` +
      `| Salaries | ${sal.toFixed(2)} ETB |\n` +
      `| Rent & Utilities | ${rnt.toFixed(2)} ETB |\n` +
      `| Raw Materials | ${mat.toFixed(2)} ETB |\n` +
      `| Depreciation | ${dep.toFixed(2)} ETB |\n` +
      `| Interest | ${intv.toFixed(2)} ETB |\n` +
      `| Charity (capped ≤10%) | ${chUsed.toFixed(2)} ETB |\n` +
      `| Taxable Profit | ${taxable.toFixed(2)} ETB |\n` +
      `| Bracket | up to ${upper === Number.POSITIVE_INFINITY ? "∞" : upper} ETB |\n` +
      `| Rate | ${(rate * 100).toFixed(0)}% |\n` +
      `| Estimated Tax | ${estimated.toFixed(2)} ETB |\n` +
      `| MAT (2.5% of turnover) | ${matTax.toFixed(2)} ETB |\n` +
      `| Final Tax | ${finalTax.toFixed(2)} ETB |\n`;
    onResult({ estimated_tax: finalTax, explanation });
    setIsCalculating(false);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Annual Revenue (ETB)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="e.g. 600,000"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Employee Salaries (ETB)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="0"
            value={salaries}
            onChange={(e) => setSalaries(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Rent & Utilities (ETB)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="0"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Raw Materials (ETB)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="0"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Depreciation (ETB)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="0"
            value={depreciation}
            onChange={(e) => setDepreciation(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Interest (ETB)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="0"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Charity (ETB) – capped ≤10% of taxable profit
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="0"
            value={charity}
            onChange={(e) => setCharity(e.target.value)}
          />
        </div>
      </div>
      <button
        onClick={calculate}
        disabled={isCalculating}
        className="mt-1 w-full rounded-full bg-gradient-to-r from-ethi-green via-ethi-yellow to-ethi-red text-white py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60"
      >
        {isCalculating ? "Calculating…" : "Calculate Sole Proprietor Tax"}
      </button>
    </div>
  );
}

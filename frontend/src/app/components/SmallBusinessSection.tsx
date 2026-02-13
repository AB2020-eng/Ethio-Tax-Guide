"use client";

import { useState } from "react";

type TaxCalcResponse = {
  estimated_tax: number;
  explanation: string;
};

export default function SmallBusinessSection({
  onResult,
}: {
  onResult: (res: TaxCalcResponse) => void;
}) {
  const [sales, setSales] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  const calculate = () => {
    if (isCalculating) return;
    setIsCalculating(true);
    const revenue = Number(sales || 0);
    const brackets: Array<[number, number]> = [
      [100000, 0.02],
      [500000, 0.03],
      [1000000, 0.05],
      [1500000, 0.07],
      [2000000, 0.09],
      [Number.POSITIVE_INFINITY, 0.09],
    ];
    let rate = 0,
      upper = 0;
    for (const [ub, r] of brackets) {
      upper = ub;
      if (revenue <= ub) {
        rate = r;
        break;
      }
    }
    const tax = Math.max(revenue * rate, 0);
    const explanation =
      "Small Business Gross Sales Tax (Category B):\n" +
      "| Item | Amount |\n" +
      "|---|---|\n" +
      `| Annual Gross Sales | ${revenue.toFixed(2)} ETB |\n` +
      `| Bracket | up to ${upper === Number.POSITIVE_INFINITY ? "∞" : upper} ETB |\n` +
      `| Rate on Sales | ${(rate * 100).toFixed(0)}% |\n` +
      `| Tax | ${tax.toFixed(2)} ETB |\n`;
    onResult({ estimated_tax: tax, explanation });
    setIsCalculating(false);
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Annual Gross Sales (ETB)
        </label>
        <input
          type="number"
          inputMode="decimal"
          className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
          placeholder="e.g. 400,000"
          value={sales}
          onChange={(e) => setSales(e.target.value)}
        />
      </div>
      <button
        onClick={calculate}
        disabled={isCalculating}
        className="mt-1 w-full rounded-full bg-gradient-to-r from-ethi-green via-ethi-yellow to-ethi-red text-white py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60"
      >
        {isCalculating ? "Calculating…" : "Calculate Small Business Tax"}
      </button>
    </div>
  );
}

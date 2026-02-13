"use client";

import { useState } from "react";

type TaxCalcResponse = {
  estimated_tax: number;
  explanation: string;
};

export default function PLCSection({
  onResult,
}: {
  onResult: (res: TaxCalcResponse) => void;
}) {
  const [grossSales, setGrossSales] = useState("");
  const [salaries, setSalaries] = useState("");
  const [rent, setRent] = useState("");
  const [materials, setMaterials] = useState("");
  const [depreciation, setDepreciation] = useState("");
  const [interest, setInterest] = useState("");
  const [other, setOther] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  const calculate = () => {
    if (isCalculating) return;
    setIsCalculating(true);
    const sales = Number(grossSales || 0);
    const salesAfterVAT = Math.max(sales - sales * 0.15, 0);
    const deductions =
      Number(salaries || 0) +
      Number(rent || 0) +
      Number(materials || 0) +
      Number(depreciation || 0) +
      Number(interest || 0) +
      Number(other || 0);
    const taxable = Math.max(salesAfterVAT - deductions, 0);
    const tax = taxable * 0.30;
    const explanation =
      "PLC / Share Company Tax:\n" +
      "| Item | Amount |\n" +
      "|---|---|\n" +
      `| Annual Gross Sales | ${sales.toFixed(2)} ETB |\n` +
      `| VAT Deduction (15%) | ${(sales * 0.15).toFixed(2)} ETB |\n` +
      `| Sales After VAT | ${salesAfterVAT.toFixed(2)} ETB |\n` +
      `| Salaries | ${Number(salaries || 0).toFixed(2)} ETB |\n` +
      `| Rent & Utilities | ${Number(rent || 0).toFixed(2)} ETB |\n` +
      `| Raw Materials | ${Number(materials || 0).toFixed(2)} ETB |\n` +
      `| Depreciation | ${Number(depreciation || 0).toFixed(2)} ETB |\n` +
      `| Interest | ${Number(interest || 0).toFixed(2)} ETB |\n` +
      `| Other Deductions | ${Number(other || 0).toFixed(2)} ETB |\n` +
      `| Taxable Profit | ${taxable.toFixed(2)} ETB |\n` +
      `| Rate | 30% |\n` +
      `| Final Tax | ${tax.toFixed(2)} ETB |\n`;
    onResult({ estimated_tax: tax, explanation });
    setIsCalculating(false);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Annual Gross Sales (ETB)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="e.g. 2,500,000"
            value={grossSales}
            onChange={(e) => setGrossSales(e.target.value)}
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
            Other Deductions (ETB)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
            placeholder="0"
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
        </div>
      </div>
      <button
        onClick={calculate}
        disabled={isCalculating}
        className="mt-1 w-full rounded-full bg-gradient-to-r from-ethi-green via-ethi-yellow to-ethi-red text-white py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60"
      >
        {isCalculating ? "Calculating…" : "Calculate PLC Tax"}
      </button>
    </div>
  );
}

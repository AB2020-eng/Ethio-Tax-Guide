"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type TaxCalcResponse = {
  estimated_tax: number;
  explanation: string;
};

type TelegramWebApp = {
  ready: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  MainButton: {
    setParams: (params: { text: string; color: string; text_color: string }) => void;
    show: () => void;
    hide: () => void;
  };
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  showAlert: (message: string) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"chat" | "calculator">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [income, setIncome] = useState("");
  const [deductions, setDeductions] = useState("");
  const [taxResult, setTaxResult] = useState<TaxCalcResponse | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [lang, setLang] = useState<"en" | "am">("en");

  const tgRef = useRef<TelegramWebApp | undefined>(undefined);
  useEffect(() => {
    if (typeof window !== "undefined") {
      tgRef.current = window.Telegram?.WebApp;
    }
  }, []);

  const API_URL = process.env.NEXT_PUBLIC_API_URL as string | undefined;

  const startPayment = useCallback(async (userId: string, pdfId: string, amount: number) => {
    try {
      const res = await fetch(`${API_URL}/api/payment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, pdf_id: pdfId, amount }),
      });
      const data = await res.json();

      if (tgRef.current && data.payment_url) {
        tgRef.current.openLink(data.payment_url, { try_instant_view: false });
      }
    } catch {
      if (tgRef.current) {
        tgRef.current.showAlert("Unable to start Telebirr payment. Please try again.");
      }
    }
  }, [API_URL]);

  useEffect(() => {
    const tg = tgRef.current;
    if (!tg) return;

    tg.ready();
    tg.setHeaderColor("#078930");
    tg.setBackgroundColor("#f9fafb");

    tg.MainButton.setParams({
      text: "Pay with Telebirr",
      color: "#078930",
      text_color: "#ffffff",
    });

    const handleMainButtonClick = () => {
      // TODO: Replace with real user/pdf/amount from context
      startPayment("demo-user", "demo-tax-guide.pdf", 50);
    };

    tg.onEvent("mainButtonClicked", handleMainButtonClick);

    return () => {
      tg.offEvent("mainButtonClicked", handleMainButtonClick);
    };
  }, [startPayment]);

  useEffect(() => {
    const tg = tgRef.current;
    if (!tg) return;
    if (isPaymentReady) {
      tg.MainButton.show();
    } else {
      tg.MainButton.hide();
    }
  }, [isPaymentReady]);

  useEffect(() => {
    if (activeTab !== "chat") return;
    if (typeof navigator === "undefined") return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setMicReady(true);
        stream.getTracks().forEach((t) => t.stop());
      })
      .catch((err) => {
        console.error("Permission denied or unavailable:", err);
        alert("Microphone access is required for chat features.");
        setMicReady(false);
      });
  }, [activeTab]);

  const addMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, role, content },
    ]);
  };

  const sendQuestion = async () => {
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput("");
    addMessage("user", text);
    setIsSending(true);
    try {
      const names = [
        "1755160957456-480715100-pdf-Ã¡_Â Ã¡__Ã¡__-Ã¡__Ã¡_Â¥Ã¡__-341-2016.pdf",
        "1755167125476-93265658-pdf-Ã¡_Â Ã¡__Ã¡__-Ã¡__Ã¡_Â¥Ã¡__-979-2008.pdf",
      ];
      const contexts: string[] = [];
      for (const n of names) {
        const r = await fetch(`${API_URL}/read-pdf/${encodeURIComponent(n)}`);
        if (r.ok) {
          const j = await r.json();
          contexts.push(j.content ?? "");
        }
      }
      const pdfContext = contexts.join("\n\n");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, pdfContext, lang }),
      });
      const data = await res.json();
      const answer = data.text ?? "No answer.";
      addMessage("assistant", answer);
    } catch {
      addMessage(
        "assistant",
        "There was an error generating an answer. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  const uploadPdf = async () => {
    if (!uploadFile || isUploading) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.indexed) {
        addMessage("assistant", `Uploaded and indexed: ${data.filename}`);
        setUploadFile(null);
      } else {
        addMessage("assistant", "Upload did not index. Please try again.");
      }
    } catch {
      addMessage("assistant", "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const calculateTax = async () => {
    if (!income || isCalculating) return;
    setIsCalculating(true);
    try {
      const res = await fetch(`${API_URL}/api/tax-calc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          income: Number(income),
          deductions: deductions ? Number(deductions) : 0,
        }),
      });
      const data: TaxCalcResponse = await res.json();
      setTaxResult(data);
      setIsPaymentReady(true);
    } catch {
      // Optionally surface error
    } finally {
      setIsCalculating(false);
    }
  };

 

  return (
    <div className="min-h-screen telegram-safe flex flex-col bg-ethi-bg px-3 pb-3 pt-4">
      <header className="mb-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-ethi-green via-ethi-yellow to-ethi-red flex items-center justify-center text-white text-lg font-bold">
            ET
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Ethiopian Tax Consultant
            </h1>
            <p className="text-[11px] text-gray-500">
              Ask questions or estimate your tax
            </p>
          </div>
          <div className="ml-auto">
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1">
              <button
                className={`px-3 py-1 text-xs rounded-full ${lang === "en" ? "bg-ethi-green text-white" : "text-gray-700"}`}
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
              >
                EN
              </button>
              <button
                className={`px-3 py-1 text-xs rounded-full ${lang === "am" ? "bg-ethi-green text-white" : "text-gray-700"}`}
                onClick={() => setLang("am")}
                aria-pressed={lang === "am"}
              >
                አማ
              </button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 bg-gray-100 p-1 rounded-full">
          <button
            className={`tab-pill ${
              activeTab === "chat" ? "tab-pill-active" : "tab-pill-inactive"
            }`}
            onClick={() => setActiveTab("chat")}
          >
            Chat Assistant
          </button>
          <button
            className={`tab-pill ${
              activeTab === "calculator"
                ? "tab-pill-active"
                : "tab-pill-inactive"
            }`}
            onClick={() => setActiveTab("calculator")}
          >
            Tax Calculator
          </button>
        </div>
      </header>

      {activeTab === "chat" ? (
        <section className="flex-1 flex flex-col rounded-3xl bg-gradient-to-b from-white to-gray-50 border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="flex-1 text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-full file:border file:border-gray-200 file:bg-white file:text-xs file:font-semibold file:text-gray-700"
              />
              <button
                onClick={uploadPdf}
                disabled={!uploadFile || isUploading}
                className="rounded-full bg-gradient-to-r from-ethi-green via-ethi-yellow to-ethi-red text-white px-4 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {isUploading ? "Uploading…" : "Upload PDF"}
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2 px-3 pb-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-xs text-gray-500 text-center mt-4">
                Ask a question about Ethiopian tax. The assistant will only
                answer based on your uploaded proclamations and will always cite
                the relevant Article.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user" ? "chat-bubble-user" : "chat-bubble-bot"
                }
              >
                {m.content}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 bg-white p-2">
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                className="flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
                placeholder="Type your tax question…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendQuestion();
                  }
                }}
              />
              <button
                onClick={sendQuestion}
                disabled={isSending || !input.trim()}
                className="rounded-full bg-ethi-green text-white px-4 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex-1 flex flex-col rounded-3xl bg-white border border-gray-100 shadow-sm p-3">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Monthly Income (ETB)
              </label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
                placeholder="e.g. 25,000"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Allowable Deductions (ETB)
              </label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
                placeholder="Optional"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={calculateTax}
            disabled={!income || isCalculating}
            className="mt-4 w-full rounded-full bg-gradient-to-r from-ethi-green via-ethi-yellow to-ethi-red text-white py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60"
          >
            {isCalculating ? "Calculating…" : "Calculate Tax"}
          </button>

          {taxResult && (
            <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-100 p-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Estimated Monthly Tax
                </span>
                <span className="text-lg font-bold text-ethi-green">
                  {taxResult.estimated_tax.toLocaleString("en-ET", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  ETB
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                {taxResult.explanation}
              </p>
              <p className="mt-2 text-[11px] text-ethi-red font-medium">
                This is an estimate only. Always cross-check with the latest
                Ethiopian tax proclamations.
              </p>
            </div>
          )}

          <div className="mt-auto pt-3 text-[11px] text-gray-500">
            After payment via the Telegram Main Button (Telebirr), your
            consultant can unlock downloadable PDF guidance for you.
          </div>
        </section>
      )}
    </div>
  );
}

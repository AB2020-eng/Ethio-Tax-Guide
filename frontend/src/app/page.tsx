"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  rating?: "like" | "dislike";
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

type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
  onerror: (e: unknown) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
    webkitSpeechRecognition?: new () => SpeechRecognitionType;
    SpeechRecognition?: new () => SpeechRecognitionType;
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"chat" | "calculator">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [income, setIncome] = useState(""); // Monthly Salary (Employee)
  const [taxResult, setTaxResult] = useState<TaxCalcResponse | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPaymentReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [lang, setLang] = useState<"en" | "am">("en");
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [calcFor, setCalcFor] = useState<"employee" | "sole" | "small" | "plc">("employee");
  const SoleSection = dynamic(() => import("./components/SoleProprietorSection"), {
    ssr: false,
    loading: () => <div className="text-xs text-gray-500">Loading…</div>,
  });

  const tgRef = useRef<TelegramWebApp | undefined>(undefined);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      tgRef.current = window.Telegram?.WebApp;
      const SR =
        (window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionType;
          webkitSpeechRecognition?: new () => SpeechRecognitionType;
        }).SpeechRecognition ||
        (window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionType;
          webkitSpeechRecognition?: new () => SpeechRecognitionType;
        }).webkitSpeechRecognition;
      setRecognitionSupported(!!SR);
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
    const wasFirst = messages.length === 0;
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
      const usedLang: "en" | "am" = /[\u1200-\u137F]/.test(text) ? "am" : lang;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, pdfContext, lang: usedLang, isFirst: wasFirst }),
      });
      if (!res.ok) {
        const errJson: unknown = await res.json().catch(() => undefined);
        let msg =
          "The assistant is temporarily unavailable. Please try again.";
        if (typeof errJson === "object" && errJson !== null) {
          const eobj = errJson as { error?: string; message?: string };
          msg = eobj.error ?? eobj.message ?? msg;
        }
        addMessage("assistant", msg);
        return;
      }
      const data = await res.json();
      const answer = data.text ?? "No answer.";
      addMessage("assistant", answer);
      if (speakEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(answer);
        utter.lang = usedLang === "am" ? "am-ET" : "en-US";
        window.speechSynthesis.speak(utter);
      }
    } catch {
      addMessage(
        "assistant",
        "There was an error generating an answer. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  const startVoice = () => {
    if (!recognitionSupported) {
      alert("Voice recognition is not supported on this device.");
      return;
    }
    const SRCtor =
      ((window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionType;
        webkitSpeechRecognition?: new () => SpeechRecognitionType;
      }).SpeechRecognition ??
        (window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionType;
          webkitSpeechRecognition?: new () => SpeechRecognitionType;
        }).webkitSpeechRecognition) ?? null;
    if (!SRCtor) {
      alert("Voice recognition is not supported on this device.");
      return;
    }
    const rec = new SRCtor();
    recognitionRef.current = rec;
    rec.lang = lang === "am" ? "am-ET" : "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      setIsRecording(false);
      sendQuestion();
    };
    rec.onerror = () => {
      setIsRecording(false);
    };
    rec.onend = () => {
      setIsRecording(false);
    };
    setIsRecording(true);
    rec.start();
  };

  const stopVoice = () => {
    const rec = recognitionRef.current;
    if (rec) {
      rec.stop();
    }
    setIsRecording(false);
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const isAmharic = /[\u1200-\u137F]/.test(text);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = isAmharic ? "am-ET" : "en-US";
    window.speechSynthesis.speak(utter);
  };

  const sendFeedback = async (messageId: string, rating: "like" | "dislike") => {
    try {
      const idx = messages.findIndex((m) => m.id === messageId);
      const answer = idx >= 0 ? messages[idx].content : undefined;
      const prevUser = idx >= 0 ? [...messages.slice(0, idx)].reverse().find((m) => m.role === "user") : undefined;
      const question = prevUser?.content;
      if (!API_URL) return;
      await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, rating, question, answer, lang }),
      });
    } catch {
      // ignore
    }
  };

  const handleRate = (id: string, rating: "like" | "dislike") => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, rating } : m)));
    sendFeedback(id, rating);
  };

  const calculateEmployee = () => {
    const salary = Number(income || 0);
    const pension = salary * 0.07;
    const taxable = Math.max(salary - pension, 0);
    const brackets: Array<[number, number]> = [
      [2000, 0.0],
      [4000, 0.15],
      [7000, 0.20],
      [10000, 0.25],
      [14000, 0.30],
      [Number.POSITIVE_INFINITY, 0.35],
    ];
    let rate = 0, upper = 0;
    for (const [ub, r] of brackets) {
      upper = ub;
      if (taxable <= ub) {
        rate = r;
        break;
      }
    }
    const estimated = Math.max(taxable * rate, 0);
    const explanation =
      "Monthly Employment Tax:\n" +
      "| Item | Amount |\n" +
      "|---|---|\n" +
      `| Salary | ${salary.toFixed(2)} ETB |\n` +
      `| Employee Pension (7%) | ${pension.toFixed(2)} ETB |\n` +
      `| Monthly Salary After Pension | ${taxable.toFixed(2)} ETB |\n` +
      `| Bracket | up to ${upper === Number.POSITIVE_INFINITY ? "∞" : upper} ETB |\n` +
      `| Rate | ${(rate * 100).toFixed(0)}% |\n` +
      `| Estimated Tax | ${estimated.toFixed(2)} ETB |\n`;
    setTaxResult({ estimated_tax: estimated, explanation });
  };


  const calculateTax = async () => {
    if (!income || isCalculating) return;
    setIsCalculating(true);
    try {
      if (calcFor === "employee") {
        calculateEmployee();
      } else {
        setTaxResult({
          estimated_tax: 0,
          explanation:
            "Business calculation coming soon. Please select Employee for now.",
        });
      }
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
          <div className="ml-auto flex items-center gap-2 px-2">
            <span className="text-[11px] text-gray-600">Speak answers</span>
            <button
              className={`px-3 py-1 text-xs rounded-full ${speakEnabled ? "bg-ethi-green text-white" : "bg-white text-gray-700 border border-gray-200"}`}
              onClick={() => setSpeakEnabled((v) => !v)}
              aria-pressed={speakEnabled}
              title="Toggle spoken answers"
            >
              {speakEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      </header>

      {activeTab === "chat" ? (
        <section className="flex-1 flex flex-col rounded-3xl bg-gradient-to-b from-white to-gray-50 border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-2 p-3" />
          <div className="flex-1 flex flex-col gap-2 px-3 pb-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-xs text-gray-500 text-center mt-4">
                Ask a question about Ethiopian tax or calculate your tax. The assistant will only answer based on Ethiopian tax law proclamations.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id}>
                <div
                  className={
                    m.role === "user" ? "chat-bubble-user" : "chat-bubble-bot"
                  }
                >
                  {m.content}
                </div>
                {m.role === "assistant" && (
                  <div className="mt-1 ml-10 flex items-center gap-2 text-[11px]">
                    <button
                      className={`px-2 py-1 rounded-full border ${m.rating === "like" ? "bg-ethi-green text-white border-ethi-green" : "border-gray-200 text-gray-700"}`}
                      onClick={() => handleRate(m.id, "like")}
                      aria-pressed={m.rating === "like"}
                      title="Like"
                    >
                      👍
                    </button>
                    <button
                      className={`px-2 py-1 rounded-full border ${m.rating === "dislike" ? "bg-ethi-red text-white border-ethi-red" : "border-gray-200 text-gray-700"}`}
                      onClick={() => handleRate(m.id, "dislike")}
                      aria-pressed={m.rating === "dislike"}
                      title="Dislike"
                    >
                      👎
                    </button>
                    <button
                      className="px-2 py-1 rounded-full border border-gray-200 text-gray-700"
                      onClick={() => speakText(m.content)}
                      title="Play audio"
                    >
                      ▶
                    </button>
                  </div>
                )}
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
                onClick={isRecording ? stopVoice : startVoice}
                className={`rounded-full ${isRecording ? "bg-ethi-red" : "bg-ethi-yellow"} text-white px-3 py-2 text-xs font-semibold`}
                aria-pressed={isRecording}
                title="Record voice"
                disabled={!micReady || !recognitionSupported}
              >
                {isRecording ? "Stop" : "🎤"}
              </button>
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
                Calculate Tax For:
              </label>
              <div className="flex gap-2">
                {[
                  { key: "employee", label: "Employee" },
                  { key: "sole", label: "Sole Proprietor" },
                  { key: "small", label: "Small Business" },
                  { key: "plc", label: "PLC" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    className={`tab-pill ${calcFor === (opt.key as typeof calcFor) ? "tab-pill-active" : "tab-pill-inactive"}`}
                    onClick={() => setCalcFor(opt.key as typeof calcFor)}
                    aria-pressed={calcFor === (opt.key as typeof calcFor)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {calcFor === "employee"
                  ? "Monthly Salary (ETB)"
                  : calcFor === "sole"
                  ? "Annual Revenue (ETB)"
                  : "Monthly Income (ETB)"}
              </label>
              {calcFor !== "sole" && (
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ethi-green/60"
                  placeholder="e.g. 25,000"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                />
              )}
            </div>
            {calcFor === "employee" && (
              <div className="text-[11px] text-gray-600">
                Pension (Employee 7%) will be subtracted automatically.
              </div>
            )}
            {calcFor === "sole" && (
              <SoleSection onResult={(res) => setTaxResult(res)} />
            )}
          </div>

          {calcFor !== "sole" && (
            <button
              onClick={calculateTax}
              disabled={!income || isCalculating}
              className="mt-4 w-full rounded-full bg-gradient-to-r from-ethi-green via-ethi-yellow to-ethi-red text-white py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60"
            >
              {isCalculating ? "Calculating…" : "Calculate Tax"}
            </button>
          )}

          {taxResult && (
            <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-100 p-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-500">
                  {calcFor === "employee" ? "Estimated Monthly Tax" : "Estimated Tax"}
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

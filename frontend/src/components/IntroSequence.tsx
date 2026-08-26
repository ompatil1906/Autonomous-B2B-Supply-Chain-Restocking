import { useState, useEffect } from "react";
import { C } from "../lib/theme";

interface IntroSequenceProps {
  onComplete: () => void;
}

const SCREENS = [
  {
    tag: "01 — THE PROBLEM",
    title: "Stockouts cost merchants 8% in lost revenue.",
    desc: "Generic dashboards tell you what happened after the money is already lost. When high-velocity festival drops happen, waiting for a human to hit 'restock' means losing out on critical GMV.",
    visual: (
      <div className="flex items-end h-32 gap-3 pb-4 opacity-80 border-b" style={{ borderColor: C.hairStrong }}>
        <div className="w-12 bg-red-400 rounded-t h-32 animate-pulse" />
        <div className="w-12 bg-red-400 rounded-t h-20" />
        <div className="w-12 bg-red-400 rounded-t h-12" />
        <div className="w-12 bg-red-400 rounded-t h-4" />
        <div className="text-red-500 font-bold tracking-widest pl-4 self-center uppercase text-sm">Stockout</div>
      </div>
    )
  },
  {
    tag: "02 — THE OPPORTUNITY",
    title: "Live signals contain everything you need.",
    desc: "By continuously monitoring checkout velocity and supplier pricing in real-time, the data is already there. The problem is identifying the pattern and acting on it instantly.",
    visual: (
      <div className="w-full flex items-center justify-between text-sm" style={{ color: C.blue, fontFamily: C.mono }}>
        <div className="p-4 bg-white rounded shadow-sm border border-[rgba(0,0,0,0.05)]">Raw Signals</div>
        <div className="text-xl">→</div>
        <div className="p-4 bg-white rounded shadow-sm border border-[rgba(0,0,0,0.05)]">Intelligence</div>
        <div className="text-xl">→</div>
        <div className="p-4 bg-white rounded shadow-sm border border-[rgba(0,0,0,0.05)] text-blue-600 font-bold">Opportunity</div>
      </div>
    )
  },
  {
    tag: "03 — THE SOLUTION",
    title: "Meet Warden.",
    desc: "An autonomous agent that predicts stockouts before they happen, negotiates with suppliers over B2B APIs, and executes restocks automatically.",
    visual: (
      <div className="text-center font-bold text-6xl tracking-tighter" style={{ color: C.blue }}>
        WARDEN
      </div>
    )
  },
  {
    tag: "04 — HOW IT WORKS",
    title: "Telemetry → Negotiation → Execution",
    desc: "Warden ingests live sales data, determines the optimal restock quantity, verifies it against the merchant's AP2 Cryptographic Intent Mandate, and calls the Razorpay API to execute the payment.",
    visual: (
      <div className="flex flex-col gap-4 w-full">
        <div className="flex justify-between items-center bg-white p-4 rounded shadow-sm border border-gray-100">
          <span className="font-semibold text-gray-700">1. Observe</span>
          <span className="text-xs text-gray-400 font-mono">150 units/min</span>
        </div>
        <div className="flex justify-between items-center bg-white p-4 rounded shadow-sm border border-gray-100">
          <span className="font-semibold text-gray-700">2. Negotiate</span>
          <span className="text-xs text-gray-400 font-mono">80 qty @ ₹160</span>
        </div>
        <div className="flex justify-between items-center bg-white p-4 rounded shadow-sm border border-green-200">
          <span className="font-semibold text-green-700">3. Execute</span>
          <span className="text-xs text-green-600 font-mono">Razorpay AP2</span>
        </div>
      </div>
    )
  },
  {
    tag: "05 — AI INTELLIGENCE",
    title: "Not just a chatbot. An autonomous engine.",
    desc: "Warden doesn't just guess. It mathematically calculates the optimal restock quantity by comparing live stock, sales velocity, supplier pricing, and the merchant's cryptographic spending limits.",
    visual: (
      <div className="bg-slate-50 p-6 rounded border border-slate-200 font-mono text-sm text-slate-600 w-full overflow-hidden text-left">
        <div>&gt; Analyzing SKU-F3 trajectory...</div>
        <div className="text-blue-600">&gt; Stockout predicted in 35s.</div>
        <div>&gt; Mandate ceiling: ₹12,000</div>
        <div className="text-green-600">&gt; Optimal Action: Restock 80 units</div>
      </div>
    )
  },
  {
    tag: "06 — BUSINESS IMPACT",
    title: "Prevented stockouts = direct GMV retained.",
    desc: "During high-traffic events like Diwali, a 2-minute stockout can cost thousands. Warden operates in milliseconds.",
    visual: (
      <div className="flex gap-4">
        <div className="flex-1 bg-white p-6 rounded shadow-sm text-center">
          <div className="text-4xl font-bold text-green-600 mb-2">100%</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Uptime Maintained</div>
        </div>
        <div className="flex-1 bg-white p-6 rounded shadow-sm text-center">
          <div className="text-4xl font-bold text-blue-600 mb-2">0ms</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Human Latency</div>
        </div>
      </div>
    )
  },
  {
    tag: "07 — WHY IT MATTERS",
    title: "Traditional vs. Autonomous",
    desc: "A traditional dashboard tells you what happened yesterday. Warden tells you what to do right now, and can do it for you.",
    visual: (
      <div className="flex w-full gap-4 text-sm">
        <div className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded text-center opacity-60">
          <div className="font-bold mb-2">Traditional</div>
          <div>"You ran out of stock."</div>
        </div>
        <div className="flex-1 p-4 bg-blue-50 border border-blue-200 rounded text-center">
          <div className="font-bold mb-2 text-blue-700">Warden</div>
          <div className="text-blue-600">"I restocked 80 units before you ran out."</div>
        </div>
      </div>
    )
  },
  {
    tag: "08 — PRODUCT PREVIEW",
    title: "The Live Ops Engine.",
    desc: "You are about to enter the Mission Control dashboard. You will see live telemetry, AI reasoning, and cryptographic payment ledgers.",
    visual: (
      <div className="relative w-full h-40 bg-[#FAFAFA] rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="h-10 border-b border-slate-200 bg-white flex items-center px-4 gap-4">
          <div className="w-24 h-3 bg-slate-200 rounded" />
          <div className="w-16 h-3 bg-slate-100 rounded" />
          <div className="w-16 h-3 bg-slate-100 rounded" />
        </div>
        <div className="flex-1 p-4 flex gap-4">
          <div className="flex-[2] flex flex-col gap-3">
            <div className="w-full h-8 bg-white border border-slate-200 rounded shadow-sm" />
            <div className="w-full h-12 bg-white border border-slate-200 rounded shadow-sm" />
          </div>
          <div className="flex-[1] flex flex-col gap-3">
            <div className="w-full h-16 bg-blue-50 border border-blue-100 rounded shadow-sm flex items-center justify-center text-blue-500 font-bold text-xs">
              Agent Active
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    tag: "09 — READY TO EXPLORE",
    title: "Your business data is ready.",
    desc: "Let AI turn merchant signals into actionable growth opportunities.",
    visual: null,
    isFinal: true
  }
];

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      
      if (e.key === "ArrowRight") {
        setStep((s) => Math.min(s + 1, SCREENS.length - 1));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(s - 1, 0));
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const screen = SCREENS[step];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center animate-fade-in" style={{ background: C.bg }}>
      <div className="w-full max-w-2xl px-6 flex flex-col min-h-[500px] justify-center relative">
        
        {/* Step Indicator */}
        <div className="text-xs tracking-[0.2em] font-medium mb-8" style={{ color: C.textMuted }}>
          {(step + 1).toString().padStart(2, "0")} / {SCREENS.length.toString().padStart(2, "0")}
        </div>

        {/* Content Container with key-based animation reset */}
        <div key={step} className="animate-slide-in flex flex-col items-start w-full">
          <div className="text-xs font-bold tracking-widest mb-6" style={{ color: "var(--color-accent-blue)" }}>
            {screen.tag}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight" style={{ color: C.textHi }}>
            {screen.title}
          </h1>
          
          <p className="text-lg md:text-xl leading-relaxed mb-12" style={{ color: C.textLo }}>
            {screen.desc}
          </p>

          {/* Visual Element */}
          {screen.visual && (
            <div className="w-full mb-12 flex justify-center items-center">
              {screen.visual}
            </div>
          )}

          {screen.isFinal && (
            <button
              onClick={onComplete}
              className="mt-4 px-8 py-4 bg-[#02042B] text-white rounded font-medium text-lg shadow-[0_4px_14px_0_rgba(2,4,43,0.39)] hover:bg-[#121543] hover:shadow-[0_6px_20px_rgba(2,4,43,0.23)] hover:-translate-y-0.5 transition-all w-full md:w-auto text-center"
            >
              Explore Dashboard →
            </button>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="absolute bottom-0 left-6 right-6 flex items-center justify-between border-t pt-6" style={{ borderColor: C.hair }}>
          <button
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
            className={`px-4 py-2 font-medium transition-colors ${step === 0 ? "opacity-30 cursor-not-allowed" : "hover:text-[#02042B]"}`}
            style={{ color: step === 0 ? C.textMuted : C.textLo }}
          >
            ← Back
          </button>
          
          <div className="flex flex-col items-center">
            {/* Dots */}
            <div className="flex gap-2 mb-3">
              {SCREENS.map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{ background: i === step ? "var(--color-accent-blue)" : C.hairStrong }}
                />
              ))}
            </div>
            
            <button
              onClick={onComplete}
              className="text-xs hover:underline transition-opacity opacity-60 hover:opacity-100"
              style={{ color: C.textLo }}
            >
              Skip for now
            </button>
          </div>

          <button
            onClick={() => {
              if (step === SCREENS.length - 1) onComplete();
              else setStep((s) => Math.min(s + 1, SCREENS.length - 1));
            }}
            className="px-4 py-2 font-medium transition-colors hover:text-[#02042B]"
            style={{ color: C.textLo }}
          >
            {step === SCREENS.length - 1 ? "Start" : "Next →"}
          </button>
        </div>
        
      </div>
    </div>
  );
}

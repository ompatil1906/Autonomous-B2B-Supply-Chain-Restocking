import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function LandingPage({ onComplete }: { onComplete: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial load animation for hero section
      gsap.from(".hero-element", {
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: "power3.out"
      });

      // Scroll animations for sections
      gsap.utils.toArray<HTMLElement>(".reveal-section").forEach((section) => {
        gsap.fromTo(section,
          { y: 50, opacity: 0 },
          {
            scrollTrigger: {
              trigger: section,
              start: "top 90%",
            },
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out"
          }
        );
      });

      // Feature cards stagger
      gsap.utils.toArray<HTMLElement>(".feature-grid").forEach((grid) => {
        gsap.fromTo(grid.querySelectorAll(".feature-card"),
          { y: 30, opacity: 0 },
          {
            scrollTrigger: {
              trigger: grid,
              start: "top 90%",
            },
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: "power2.out"
          }
        );
      });

      // Massive Logo Animation
      gsap.fromTo(".warden-logo-anim",
        { scale: 0.8, opacity: 0, y: 40 },
        {
          scrollTrigger: {
            trigger: ".warden-logo-anim",
            start: "top 85%",
          },
          scale: 1,
          opacity: 1,
          y: 0,
          duration: 2,
          ease: "expo.out",
          onComplete: () => {
            gsap.to(".warden-logo-anim", {
              y: -20,
              rotation: 1,
              duration: 4,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut"
            });
          }
        }
      );

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden selection:bg-blue-100 selection:text-blue-900 relative">
      
      {/* STICKY NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold tracking-tight text-xl text-slate-900 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            WARDEN
          </div>
          <button
            onClick={onComplete}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-sm font-semibold rounded-full shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
          >
            Go to Dashboard
          </button>
        </div>
      </nav>

      {/* 1. HERO SECTION */}
      <section className="w-full max-w-7xl mx-auto px-6 pt-32 pb-20 flex flex-col items-center text-center">


        <img
          src="/logo/logo.png"
          alt="Warden Logo"
          className="h-28 md:h-36 w-auto object-contain hero-element mb-10 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-slate-100"
        />

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight hero-element mb-8 text-slate-900 leading-[1.1]">
          Autonomous B2B <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            Supply Chain Restocking
          </span>
        </h1>

        <p className="text-xl md:text-2xl max-w-3xl mx-auto hero-element mb-12 text-slate-500 leading-relaxed font-light">
          Predict stockouts, negotiate with suppliers in real-time, and execute restocks automatically before your business loses critical GMV.
        </p>

        <button
          onClick={onComplete}
          className="hero-element group px-8 py-5 bg-slate-900 text-white rounded-2xl font-semibold text-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-black hover:shadow-[0_8px_40px_rgba(0,0,0,0.2)] hover:-translate-y-1 transition-all duration-300 mb-20 flex items-center gap-4 mx-auto"
        >
          <span>Go to Dashboard</span>
          <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>

        {/* Hero Video */}
        <div className="w-full max-w-6xl mx-auto rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 bg-slate-900 hero-element relative">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent pointer-events-none z-10" />
          <video
            src="/video/demo.mp4"
            autoPlay
            muted
            loop
            playsInline
            controls
            disablePictureInPicture
            disableRemotePlayback
            className="w-full h-auto aspect-video object-cover relative z-0"
          />
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-12" />

      {/* 2. THE PROBLEM & OPPORTUNITY */}
      <section className="w-full max-w-7xl mx-auto px-6 py-20 reveal-section">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-sm font-bold tracking-widest mb-4 text-red-500">01 — THE PROBLEM</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 tracking-tight">
              Stockouts cost merchants 8% in lost revenue.
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-6">
              Generic dashboards tell you what happened after the money is already lost. When high-velocity festival drops happen, waiting for a human to hit 'restock' means losing out on critical GMV.
            </p>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-4xl font-bold text-red-500">-8%</div>
              <div className="text-sm text-slate-500 font-medium leading-snug">Average revenue lost<br />to manual restocking delays.</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 feature-grid">
            <div className="feature-card p-6 rounded-2xl bg-white shadow-lg shadow-slate-100 border border-slate-100">
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4 font-bold">1</div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Raw Signals</h4>
              <p className="text-sm text-slate-500">Continuous telemetry of checkout velocity and supplier pricing.</p>
            </div>
            <div className="feature-card p-6 rounded-2xl bg-white shadow-lg shadow-slate-100 border border-slate-100">
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4 font-bold">2</div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Intelligence</h4>
              <p className="text-sm text-slate-500">Predictive models identifying stockout patterns before they occur.</p>
            </div>
            <div className="feature-card p-6 rounded-2xl bg-white shadow-lg shadow-slate-100 border border-slate-100 sm:col-span-2">
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-4 font-bold">3</div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Execution</h4>
              <p className="text-sm text-slate-500">Live negotiation and automatic purchasing via Razorpay APIs, saving hours of manual work and retaining 100% of potential GMV.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FOUNDATIONAL PILLARS */}
      <section className="w-full bg-slate-50 py-24 border-y border-slate-200 mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 reveal-section">
          <div className="text-center mb-16">
            <div className="text-sm font-bold tracking-widest mb-4 text-blue-600">02 — ARCHITECTURE</div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Three Foundational Pillars
            </h2>
            <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">
              Built on bleeding-edge architectures that redefine autonomous agentic commerce.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 feature-grid">
            {/* Pillar 1 */}
            <div className="feature-card bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-28 h-28 rounded-[2rem] bg-slate-50 flex items-center justify-center text-2xl mb-8 border border-slate-100 shadow-sm overflow-hidden">
                <img src="/logo/langraph.png" alt="LangGraph" className="w-24 h-24 object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Agentic Intelligence with LangGraph</h3>
              <p className="text-slate-600 leading-relaxed">
                Warden does not make a one-shot guess. It continuously evaluates changing conditions, predicts stockout risk, and determines the optimal action.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="feature-card bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-28 h-28 rounded-[2rem] bg-white flex items-center justify-center text-2xl mb-8 border border-slate-100 shadow-sm">
                <img src="/logo/razorpay.svg" alt="Razorpay MCP" className="w-20 h-20 object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Model Context Protocol (MCP)</h3>
              <p className="text-slate-600 leading-relaxed">
                Warden uses isolated MCP servers for the warehouse, suppliers, and Razorpay, giving the agent precise operational access without unrestricted control.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="feature-card bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex gap-4 mb-8">
                <div className="w-28 h-28 rounded-[2rem] bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                  <img src="/logo/google.png" alt="Google" className="w-16 h-16 object-contain" />
                </div>
                <div className="w-28 h-28 rounded-[2rem] bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                  <img src="/logo/razorpay.svg" alt="Razorpay" className="w-20 h-20 object-contain" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">AP2-inspired Cryptographically Bound</h3>
              <p className="text-slate-600 leading-relaxed space-y-3">
                <span className="block">Before any money moves, Warden verifies the transaction against the merchant’s cryptographic intent mandate. Every transaction must pass deterministic boundary checks and Ed25519 signature verification.</span>
                <span className="block">The AI cannot override the merchant’s predefined spending limits. Once everything is verified, Warden selects the optimal supplier, calculates the restock quantity, and executes the payment through the Razorpay API.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS TERMINAL */}
      <section className="w-full max-w-7xl mx-auto px-6 py-24 reveal-section">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 rounded-2xl bg-[#0F1117] p-6 shadow-2xl border border-slate-800 font-mono text-sm text-slate-400 overflow-hidden relative">
            <div className="flex gap-2 mb-4 border-b border-slate-800 pb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="space-y-3">
              <div><span className="text-blue-400">warden</span> <span className="text-slate-300">analyze</span> --sku SKU-F3</div>
              <div className="text-slate-500">&gt; Ingesting live sales velocity: 12 units/min</div>
              <div className="text-slate-500">&gt; Current stock: 85 units</div>
              <div className="text-amber-400">&gt; ALERT: Stockout predicted in 90 seconds.</div>
              <div className="text-slate-500">&gt; Checking AP2-inspired mandate ceiling: ₹11,200 limit</div>
              <div className="text-slate-500">&gt; Negotiating with supplier... quote ₹160/unit</div>
              <div className="text-emerald-400">&gt; Action: Executing restock for 70 units (₹11,200)</div>
              <div className="text-slate-500">&gt; Verifying Ed25519 signatures... <span className="text-green-400">Valid</span></div>
              <div className="text-slate-500">&gt; Razorpay order created (mode=remote_test) — live capture webhook pending</div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="text-sm font-bold tracking-widest mb-4 text-emerald-600">03 — AI IN ACTION</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 tracking-tight">
              Not just a chatbot.<br />An autonomous engine.
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              Warden doesn't just guess. It mathematically calculates the optimal restock quantity by comparing live stock, sales velocity, supplier pricing, and your cryptographic spending limits.
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">1</div>
                <div className="flex-1 font-semibold text-slate-900">Observe</div>
                <div className="text-sm font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">12 units/min</div>
              </div>
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">2</div>
                <div className="flex-1 font-semibold text-slate-900">Negotiate</div>
                <div className="text-sm font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">80 qty @ ₹160</div>
              </div>
              <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">3</div>
                <div className="flex-1 font-semibold text-emerald-700">Execute</div>
                <div className="text-sm font-mono text-emerald-600 bg-white px-2 py-1 rounded border border-emerald-100 shadow-sm">Razorpay (AP2-inspired)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CREATOR INFO */}
      <section className="w-full max-w-5xl mx-auto px-6 py-16 reveal-section">
        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 flex flex-col md:flex-row items-center gap-10 hover:shadow-[0_8px_40px_rgb(0,0,0,0.12)] transition-shadow duration-300">
          <img
            src="/Om.jpg"
            alt="Om Patil"
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover shadow-lg border-4 border-slate-50"
          />
          <div className="flex-1 text-center md:text-left">
            <div className="text-xs font-bold tracking-widest mb-3 text-blue-600 uppercase">Developed By</div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Om Patil</h2>
            <p className="text-slate-500 font-medium mb-6">AI & Software Engineer</p>

            <div className="flex flex-col sm:flex-row flex-wrap items-center md:items-start gap-x-6 gap-y-4 text-sm font-medium text-slate-600">
              <a href="mailto:patilom1906@gmail.com" className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                patilom1906@gmail.com
              </a>
              <a href="tel:+917436083790" className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                +91-7436083790
              </a>
              <a href="https://www.linkedin.com/in/om-patil19/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                LinkedIn
              </a>
              <a href="https://github.com/ompatil1906/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER - MASSIVE ANIMATED LOGO */}
      <div className="w-full py-24 md:py-32 flex flex-col justify-center items-center bg-slate-50 border-t border-slate-100 overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-slate-100/50 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />
        <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center justify-center">
          <img 
            src="/logo/logo.png" 
            alt="Warden Engine" 
            className="w-full max-w-[300px] md:max-w-[500px] object-contain warden-logo-anim drop-shadow-2xl mb-8" 
          />
          <div className="text-xs md:text-sm font-bold tracking-[0.25em] text-slate-400 text-center uppercase reveal-section">
            Autonomous B2B Supply-Chain Restocking
          </div>
        </div>
      </div>

    </div>
  );
}

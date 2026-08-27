import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Shield,
  Zap,
  Brain,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Package,
  Link2,
  ChevronDown,
  Play,
  ExternalLink,
  Activity,
  Database,
  Globe,
  Cpu,
  ShieldCheck,
  X,
  GitBranch,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

// ─── Video Modal ──────────────────────────────────────────────────────────────
function VideoModal({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleClose = () => {
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.25, onComplete: onClose });
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid rgba(255,255,255,0.12)" }}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
        >
          <X size={16} />
        </button>
        <video
          src="/demo.mp4"
          controls
          autoPlay
          className="w-full"
          style={{ maxHeight: "80vh", background: "#000" }}
        />
      </div>
    </div>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedStat({ endVal, suffix, label }: { endVal: number; suffix: string; label: string }) {
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = numRef.current;
    if (!el) return;
    const obj = { val: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          val: endVal,
          duration: 2,
          ease: "power2.out",
          onUpdate: () => { el.textContent = Math.floor(obj.val).toLocaleString(); },
        });
      },
    });
  }, [endVal]);

  return (
    <div className="text-center">
      <div className="text-5xl font-bold mb-2" style={{ color: "#fff" }}>
        <span ref={numRef}>0</span>
        <span style={{ color: "#60a5fa" }}>{suffix}</span>
      </div>
      <div className="text-sm tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</div>
    </div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const videoSectionRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const mandatesRef = useRef<HTMLDivElement>(null);
  const architectureRef = useRef<HTMLDivElement>(null);
  const scenariosRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hero entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(navRef.current, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.7 })
        .fromTo(taglineRef.current, { opacity: 0, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.6 }, "-=0.3")
        .fromTo(headlineRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 }, "-=0.3")
        .fromTo(subRef.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7 }, "-=0.4")
        .fromTo(ctaRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, "-=0.3")
        .fromTo(scrollIndicatorRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.1");

      gsap.to(scrollIndicatorRef.current, { y: 10, repeat: -1, yoyo: true, duration: 1.4, ease: "sine.inOut" });

      gsap.to(".hero-orb-1", {
        y: -80,
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 1.5 },
      });
      gsap.to(".hero-orb-2", {
        y: -40,
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 1 },
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  // Section reveals
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(videoSectionRef.current,
        { opacity: 0, y: 60 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: videoSectionRef.current, start: "top 80%" } }
      );
      gsap.fromTo(".feature-card",
        { opacity: 0, y: 50, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: featuresRef.current, start: "top 75%" } }
      );
      gsap.fromTo(".mandate-step",
        { opacity: 0, x: -40 },
        { opacity: 1, x: 0, duration: 0.7, ease: "power3.out", stagger: 0.2, scrollTrigger: { trigger: mandatesRef.current, start: "top 75%" } }
      );
      gsap.fromTo(".arch-card",
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.15, scrollTrigger: { trigger: architectureRef.current, start: "top 75%" } }
      );
      gsap.fromTo(".scenario-card",
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.15, scrollTrigger: { trigger: scenariosRef.current, start: "top 75%" } }
      );
      gsap.utils.toArray<HTMLElement>(".section-title").forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } }
        );
      });
    });
    return () => ctx.revert();
  }, []);

  const features = [
    { icon: <Brain size={24} />, title: "LangGraph Orchestration", description: "A state-machine pipeline that autonomously detects, negotiates, gates, and executes restocks — with zero human prompting.", accent: "#60a5fa" },
    { icon: <Shield size={24} />, title: "AP2 Cryptographic Gate", description: "Three Ed25519-signed Verifiable Credentials form an unbreakable chain. Even if the LLM hallucinates 10,000 units, the gate refuses.", accent: "#34d399" },
    { icon: <Zap size={24} />, title: "Predictive Trigger Engine", description: "Sliding-window velocity analytics predict stockouts before they happen. Fires within a 90-second lead time, not after the fact.", accent: "#fbbf24" },
    { icon: <Link2 size={24} />, title: "Razorpay MCP Integration", description: "`capture_payment` for autonomous debit against UPI Reserve, and `create_payment_link` for human-in-the-loop fallback escalations.", accent: "#a78bfa" },
    { icon: <Activity size={24} />, title: "Live Telemetry Dashboard", description: "Real-time WebSocket feeds, sales velocity heatmaps, authority pool gauges, and a tamper-proof cryptographic audit ledger.", accent: "#fb923c" },
    { icon: <Lock size={24} />, title: "Supplier Negotiation MCP", description: "The agent queries real-time wholesale catalogs and haggles prices. The supplier cryptographically signs the CartMandate to lock the deal.", accent: "#f472b6" },
  ];

  const mandates = [
    { n: "01", issuer: "Merchant Wallet", title: "IntentMandate", description: "The human pre-authorizes exactly what the agent can do — SKU constraints, quantity caps, unit price ceilings, total budget, and expiry. Signed once, immutable forever.", color: "#60a5fa" },
    { n: "02", issuer: "B2B Supplier", title: "CartMandate", description: "What the supplier cryptographically promised: SKUs, quantities, and final settlement price. Bound to the IntentMandate, making tampering cryptographically impossible.", color: "#34d399" },
    { n: "03", issuer: "Agent", title: "PaymentMandate", description: "Why the agent paid or refused: the executed Razorpay payment_id or a structured aborted receipt. Every transaction is irrefutably auditable.", color: "#a78bfa" },
  ];

  const scenarios = [
    { emoji: "🟢", tag: "AUTONOMOUS SUCCESS", tagColor: "#34d399", title: "Normal Restock", description: "Cart total is within the Intent cap. The Gate passes, funds are captured autonomously via Razorpay MCP, and stock is replenished instantly.", outcome: "✓ Payment captured · Stock replenished", outcomeColor: "#34d399" },
    { emoji: "🔴", tag: "HUMAN FALLBACK", tagColor: "#f87171", title: "Price Spike Breach", description: "Supplier dynamically inflates the price. Cart exceeds approved budget. The Gate blocks autonomous capture and escalates via a Razorpay Payment Link.", outcome: "⚡ Gate tripped · Razorpay link sent", outcomeColor: "#f87171" },
    { emoji: "🛡️", tag: "GATE DEFENSE", tagColor: "#fbbf24", title: "Hallucinated Quantity", description: "The LLM is forced to propose an order of 10,000 units. The deterministic AP2 gate detects the boundary violation and blocks it immediately.", outcome: "⛔ Boundary violation blocked", outcomeColor: "#fbbf24" },
  ];

  const archItems = [
    { icon: <Globe size={20} />, title: "React Dashboard", sub: "Vite + TypeScript + Tailwind v4", desc: "Real-time WebSocket telemetry, mission control, audit ledger, and approvals inbox.", color: "#60a5fa" },
    { icon: <Cpu size={20} />, title: "FastAPI Backend", sub: "LangGraph + AP2 Engine", desc: "Orchestration pipeline, mandate generation, Ed25519 cryptography, and audit ledger.", color: "#34d399" },
    { icon: <Database size={20} />, title: "3 MCP Servers", sub: "Razorpay · Supplier · Warehouse", desc: "Isolated capability silos — the LLM never holds payment keys directly.", color: "#a78bfa" },
    { icon: <ShieldCheck size={20} />, title: "AP2 Verifier", sub: "Ed25519 Verifiable Credentials", desc: "The only thing that decides whether money moves. Fully deterministic, LLM-agnostic.", color: "#fbbf24" },
  ];

  return (
    <div style={{ background: "#050714", color: "#fff", overflowX: "hidden", fontFamily: "'Inter Variable', sans-serif" }}>
      {videoOpen && <VideoModal onClose={() => setVideoOpen(false)} />}

      {/* NAV */}
      <nav
        ref={navRef}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 48px",
          background: navScrolled ? "rgba(5,7,20,0.92)" : "transparent",
          borderBottom: navScrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
          backdropFilter: navScrolled ? "blur(16px)" : "none",
          transition: "all 0.4s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo/logo.png" alt="Warden" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", border: "1px solid rgba(255,255,255,0.15)" }} />
          <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Warden</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", letterSpacing: "0.08em" }}>AP2</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
          {["Features", "Mandates", "Architecture", "Scenarios"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = "#fff"}
              onMouseLeave={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,0.55)"}
            >{item}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="https://autonomous-b2b-supply-chain-restocking.onrender.com/docs" target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 14, textDecoration: "none" }}
            className="hidden md:flex"
          >
            <GitBranch size={14} /> Docs
          </a>
          <button
            onClick={onEnterApp}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, padding: "10px 20px", borderRadius: 14, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", boxShadow: "0 4px 20px rgba(99,102,241,0.4)", transition: "transform 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            Launch Dashboard <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 120px", position: "relative", overflow: "hidden" }}>
        <div className="hero-orb-1" style={{ position: "absolute", top: "-10%", left: "10%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
        <div className="hero-orb-2" style={{ position: "absolute", bottom: "-5%", right: "5%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" }} />

        <div ref={taglineRef} style={{ marginBottom: 24 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, padding: "8px 16px", borderRadius: 999, letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)", color: "#818cf8" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", animation: "pulse 2s infinite" }} />
            Razorpay Buildathon · Track 1 · AI Growth &amp; Agentic Commerce
          </span>
        </div>

        <h1 ref={headlineRef} style={{ fontSize: "clamp(2.5rem, 7vw, 5.5rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 24, maxWidth: 900, color: "#fff" }}>
          The AI Agent That{" "}
          <span style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Can't Be Fooled
          </span>{" "}
          Into Moving Your Money
        </h1>

        <p ref={subRef} style={{ fontSize: "clamp(1rem, 2vw, 1.2rem)", maxWidth: 680, marginBottom: 40, lineHeight: 1.7, color: "rgba(255,255,255,0.6)" }}>
          Warden is a production-ready autonomous B2B supply-chain purchasing agent bounded by{" "}
          <strong style={{ color: "rgba(255,255,255,0.85)" }}>cryptographic AP2 mandates</strong>. It restocks inventory autonomously while making it{" "}
          <strong style={{ color: "rgba(255,255,255,0.85)" }}>mathematically impossible</strong> for the LLM to exceed pre-approved financial boundaries.
        </p>

        <div ref={ctaRef} style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          <button
            onClick={onEnterApp}
            style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 800, padding: "16px 32px", borderRadius: 18, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", boxShadow: "0 8px 32px rgba(99,102,241,0.5)", transition: "transform 0.2s, box-shadow 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(99,102,241,0.65)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.5)"; }}
          >
            <TrendingUp size={18} /> Launch Live Dashboard
          </button>
          <button
            onClick={() => setVideoOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700, padding: "16px 32px", borderRadius: 18, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", transition: "background 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <Play size={18} /> Watch Demo Video
          </button>
        </div>

        <div ref={scrollIndicatorRef} style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.3)" }}>
          <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>Scroll</span>
          <ChevronDown size={16} />
        </div>
      </section>

      {/* DEMO VIDEO SECTION */}
      <section id="demo" ref={videoSectionRef} style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 className="section-title" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 800, marginBottom: 16, color: "#fff" }}>See Warden in Action</h2>
            <p style={{ fontSize: 16, maxWidth: 520, margin: "0 auto", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              Watch the full autonomous restocking pipeline — from stockout detection to Razorpay payment capture — in real time.
            </p>
          </div>
          <div
            style={{ position: "relative", borderRadius: 28, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.2)", background: "#0a0d1f", cursor: "pointer" }}
            onClick={() => setVideoOpen(true)}
          >
            <video src="/demo.mp4" style={{ width: "100%", maxHeight: 500, objectFit: "cover", pointerEvents: "none", display: "block" }} muted playsInline preload="metadata" />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", transition: "background 0.3s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.35)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.15)")}
            >
              <div style={{ width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.85)", boxShadow: "0 8px 40px rgba(99,102,241,0.6)", backdropFilter: "blur(8px)", transition: "transform 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <Play size={28} fill="white" color="white" style={{ marginLeft: 4 }} />
              </div>
            </div>
            <div style={{ position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", backdropFilter: "blur(8px)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} />
              Full Demo
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: "20px 24px 96px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", borderRadius: 28, padding: "64px 48px", background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(52,211,153,0.08))", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 40 }}>
            <AnimatedStat endVal={3} suffix="×" label="MCP Servers" />
            <AnimatedStat endVal={3} suffix="" label="Ed25519 Mandates" />
            <AnimatedStat endVal={90} suffix="s" label="Lead Time Trigger" />
            <AnimatedStat endVal={0} suffix="" label="Direct LLM Key Access" />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" ref={featuresRef} style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 className="section-title" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 800, marginBottom: 16, color: "#fff" }}>
              Enterprise-Grade Autonomous Commerce
            </h2>
            <p style={{ fontSize: 16, maxWidth: 560, margin: "0 auto", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              Every layer of Warden is designed for production — from the predictive engine to the cryptographic payment gate.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {features.map((f, i) => (
              <div
                key={i}
                className="feature-card"
                style={{ padding: 28, borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 24px rgba(0,0,0,0.2)", transition: "transform 0.25s, border-color 0.25s, box-shadow 0.25s", cursor: "default" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = `${f.accent}50`; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px ${f.accent}30`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.2)"; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, background: `${f.accent}18`, color: f.accent }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: "#fff" }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,0.5)" }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MANDATES */}
      <section id="mandates" ref={mandatesRef} style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 32, padding: "56px 48px" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, padding: "8px 16px", borderRadius: 999, marginBottom: 20, letterSpacing: "0.1em", textTransform: "uppercase" as const, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}>
              <ShieldCheck size={12} /> Security Core: The AP2 Evidence Chain
            </div>
            <h2 className="section-title" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 800, marginBottom: 16, color: "#fff" }}>
              Three Mandates. <span style={{ color: "#34d399" }}>Zero Trust Gaps.</span>
            </h2>
            <p style={{ fontSize: 16, maxWidth: 520, margin: "0 auto", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              The only thing that decides whether money moves is the deterministic verifier. Even if the LLM hallucinates, the gate refuses.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {mandates.map((m, i) => (
              <div key={i} className="mandate-step" style={{ display: "flex", alignItems: "flex-start", gap: 24, padding: 28, borderRadius: 20, border: `1px solid ${m.color}25`, background: `${m.color}06`, transition: "background 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.background = `${m.color}0d`)}
                onMouseLeave={e => (e.currentTarget.style.background = `${m.color}06`)}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 64 }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: m.color, opacity: 0.25 }}>{m.n}</div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "3px 8px", borderRadius: 999, background: `${m.color}18`, color: m.color, whiteSpace: "nowrap" as const }}>{m.issuer}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{m.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,0.55)" }}>{m.description}</p>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${m.color}18`, color: m.color, flexShrink: 0 }}>
                  <CheckCircle2 size={18} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="architecture" ref={architectureRef} style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 className="section-title" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 800, marginBottom: 16, color: "#fff" }}>Built for Production</h2>
            <p style={{ fontSize: 16, maxWidth: 480, margin: "0 auto", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              A clean separation of concerns across 4 layers — each with its own security boundary and failure mode.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
            {archItems.map((a, i) => (
              <div key={i} className="arch-card" style={{ padding: 28, borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", transition: "transform 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${a.color}18`, color: a.color, flexShrink: 0 }}>{a.icon}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{a.title}</h3>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 600, background: `${a.color}18`, color: a.color }}>{a.sub}</span>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.5)" }}>{a.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 24, borderRadius: 20, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "monospace" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>Agent Pipeline</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 8 }}>
              {["detect", "negotiate", "gate", "execute | escalate"].map((node, i, arr) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: [" rgba(96,165,250,0.15)", "rgba(167,139,250,0.15)", "rgba(52,211,153,0.15)", "rgba(251,191,36,0.15)"][i], color: ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24"][i], border: `1px solid ${["rgba(96,165,250,0.3)", "rgba(167,139,250,0.3)", "rgba(52,211,153,0.3)", "rgba(251,191,36,0.3)"][i]}` }}>{node}</span>
                  {i < arr.length - 1 && <ArrowRight size={14} style={{ color: "rgba(255,255,255,0.2)" }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SCENARIOS */}
      <section id="scenarios" ref={scenariosRef} style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, padding: "8px 16px", borderRadius: 999, marginBottom: 20, letterSpacing: "0.1em", textTransform: "uppercase" as const, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
              <AlertTriangle size={12} /> Evaluation Scenarios
            </div>
            <h2 className="section-title" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 800, marginBottom: 16, color: "#fff" }}>Test Every Failure Mode</h2>
            <p style={{ fontSize: 16, maxWidth: 480, margin: "0 auto", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              The dashboard ships with three pre-built scenarios — trigger them live and watch the agent reason through each case.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {scenarios.map((s, i) => (
              <div key={i} className="scenario-card" style={{ padding: 28, borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 16, transition: "transform 0.25s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-4px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <div style={{ fontSize: 40 }}>{s.emoji}</div>
                <span style={{ display: "inline-block", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 999, background: `${s.tagColor}18`, color: s.tagColor }}>{s.tag}</span>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,0.5)", flex: 1 }}>{s.description}</p>
                <div style={{ fontSize: 13, fontWeight: 600, padding: "10px 14px", borderRadius: 12, background: `${s.outcomeColor}10`, color: s.outcomeColor, border: `1px solid ${s.outcomeColor}28` }}>{s.outcome}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "128px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <img src="/logo/logo.png" alt="Warden" style={{ width: 64, height: 64, borderRadius: 20, objectFit: "cover", border: "1px solid rgba(255,255,255,0.15)" }} />
          </div>
          <h2 className="section-title" style={{ fontSize: "clamp(2rem, 5vw, 4rem)", fontWeight: 900, marginBottom: 24, lineHeight: 1.1, color: "#fff" }}>
            The Future of B2B Commerce{" "}
            <span style={{ color: "#6366f1" }}>Is Autonomous</span>
          </h2>
          <p style={{ fontSize: 18, marginBottom: 40, maxWidth: 540, margin: "0 auto 40px", color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>
            Warden eliminates revenue loss from stockouts while enforcing a strict cryptographic financial boundary. Zero hallucinations. Zero unauthorized payments.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 16, justifyContent: "center" }}>
            <button
              onClick={onEnterApp}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 800, padding: "18px 36px", borderRadius: 20, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", boxShadow: "0 8px 40px rgba(99,102,241,0.55)", transition: "transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 12px 60px rgba(99,102,241,0.7)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 40px rgba(99,102,241,0.55)"; }}
            >
              <Package size={18} /> Open Warden Dashboard
            </button>
            <a
              href="https://autonomous-b2b-supply-chain-restocking.onrender.com/docs"
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, padding: "18px 32px", borderRadius: 20, textDecoration: "none", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", transition: "background 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            >
              <ExternalLink size={16} /> API Docs
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "40px 24px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
          <img src="/logo/logo.png" alt="Warden" style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover", opacity: 0.7 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Warden</span>
        </div>
        <p style={{ fontSize: 12, marginBottom: 8 }}>Built with 💻 &amp; ☕ for the Razorpay Buildathon · Track 1: AI Growth &amp; Agentic Commerce</p>
        <p style={{ fontSize: 12 }}>
          <a href="https://warden-ebon.vercel.app" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>warden-ebon.vercel.app</a>
          {" · "}
          <a href="https://autonomous-b2b-supply-chain-restocking.onrender.com/docs" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>API Docs</a>
        </p>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

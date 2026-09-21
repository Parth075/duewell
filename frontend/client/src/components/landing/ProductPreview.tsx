import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import {
  Bell,
  CircleDollarSign,
  Zap,
  CheckCircle2,
  Receipt,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProductPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();
  const displayName = user?.name ? user.name.trim().split(" ")[0] : "there";

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.4, 1], [0.75, 0.92, 1]);

  return (
    <section
      id="preview"
      ref={containerRef}
      className="product-preview-section max-w-5xl mx-auto px-6 py-8 md:py-16"
    >
      <motion.div
        style={{
          scale: shouldReduceMotion ? 1 : scale,
          y: shouldReduceMotion ? 0 : y,
          opacity: shouldReduceMotion ? 1 : opacity,
        }}
        className="preview-frame rounded-2xl md:rounded-3xl border border-border bg-card shadow-sm p-4 sm:p-7 overflow-hidden cursor-pointer hover:border-primary/40 transition-colors group"
        onClick={() => navigate("/overview")}
        title="Click to explore interactive dashboard"
      >
        {/* Mockup Header bar */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-border" />
            <span className="w-2.5 h-2.5 rounded-full bg-border" />
            <span className="w-2.5 h-2.5 rounded-full bg-border" />
            <span className="ml-3 text-[11px] font-medium text-muted-foreground hidden sm:inline">
              app.duewell.com/overview
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="status-pill status-green text-[10px]">
              <ShieldCheck size={12} /> Sync active
            </span>
            <span className="text-xs font-semibold text-primary hidden sm:flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Open live app <ChevronRight size={13} />
            </span>
          </div>
        </div>

        {/* Mockup Dashboard Body */}
        <div className="space-y-6 select-none">
          {/* Mock Greeting */}
          <div className="flex items-baseline justify-between">
            <div>
              <p className="eyebrow mb-1">Friday, September 18, 2026</p>
              <h2
                className="text-2xl sm:text-3xl font-normal text-foreground"
                style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
              >
                Good evening, {displayName}
              </h2>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">
              A clear view of what’s coming up.
            </span>
          </div>

          {/* Mock 3 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Outstanding */}
            <div className="summary-card" style={{ minHeight: "105px" }}>
              <div className="summary-icon primary">
                <CircleDollarSign size={17} />
              </div>
              <div className="summary-card-main">
                <p>Outstanding</p>
                <strong>₹22,149</strong>
                <span>across 4 upcoming bills</span>
              </div>
            </div>

            {/* Due Soon */}
            <div className="summary-card" style={{ minHeight: "105px" }}>
              <div className="summary-icon amber">
                <Bell size={17} />
              </div>
              <div className="summary-card-main">
                <p>Due this week</p>
                <strong>2</strong>
                <span>Next: Airtel on Sep 21</span>
              </div>
            </div>

            {/* Overdue */}
            <div className="summary-card" style={{ minHeight: "105px" }}>
              <div className="summary-icon red">
                <Zap size={17} />
              </div>
              <div className="summary-card-main">
                <p>Needs attention</p>
                <strong>1</strong>
                <span>HDFC card · 2 days late</span>
              </div>
            </div>
          </div>

          {/* Mock Bill Cards Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Bill 1 */}
            <div className="border border-border rounded-xl p-4 bg-background/50 flex flex-col justify-between h-32">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Airtel Broadband</h3>
                  <p className="text-[10px] text-muted-foreground">Internet</p>
                </div>
                <span className="status-pill status-amber text-[9px]">Due in 3d</span>
              </div>
              <div className="flex items-baseline justify-between mt-auto">
                <span className="font-serif text-lg text-foreground">₹1,299</span>
                <span className="text-[10px] text-muted-foreground">Due Sep 21</span>
              </div>
            </div>

            {/* Bill 2 */}
            <div className="border border-red-200 dark:border-red-950/40 rounded-xl p-4 bg-red-50/30 dark:bg-red-950/10 flex flex-col justify-between h-32">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">HDFC Bank</h3>
                  <p className="text-[10px] text-muted-foreground">Credit card</p>
                </div>
                <span className="status-pill status-red text-[9px]">Overdue</span>
              </div>
              <div className="flex items-baseline justify-between mt-auto">
                <span className="font-serif text-lg text-foreground">₹18,420</span>
                <span className="text-[10px] text-red-500 font-medium">Due Sep 18</span>
              </div>
            </div>

            {/* Bill 3 */}
            <div className="border border-border rounded-xl p-4 bg-background/50 flex flex-col justify-between h-32">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">MSEDCL Power</h3>
                  <p className="text-[10px] text-muted-foreground">Electricity</p>
                </div>
                <span className="status-pill status-green text-[9px] flex items-center gap-1">
                  <CheckCircle2 size={10} /> Autopay
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-auto">
                <span className="font-serif text-lg text-foreground">₹2,430</span>
                <span className="text-[10px] text-muted-foreground">Due Sep 24</span>
              </div>
            </div>
          </div>

          {/* AI Banner */}
          <div className="insight-banner py-2.5 px-4 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles size={15} className="text-amber-600" />
              <span>
                <strong>Smart reminder ready:</strong> Next dispatch scheduled for tomorrow at 9:00 AM.
              </span>
            </div>
            <span className="text-[11px] font-semibold text-primary underline">
              View alert
            </span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

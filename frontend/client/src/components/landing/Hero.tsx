import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Hero() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const easeCustom = [0.16, 1, 0.3, 1];

  return (
    <section className="landing-hero relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24 px-6 text-center">
      {/* --- Ambient Background Layer --- */}
      <div className="hero-ambient-layer absolute inset-0 pointer-events-none overflow-hidden select-none -z-10" aria-hidden="true">
        {/* Layer 1: Drifting blurred indigo blobs */}
        {!shouldReduceMotion ? (
          <>
            {/* Blob 1: Top-center-left subtle drift */}
            <motion.div
              className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-12 -top-24 left-1/4"
              style={{
                background: "radial-gradient(circle, #5B5FEF 0%, #818CF8 50%, transparent 75%)",
              }}
              animate={{
                x: [-35, 45, -20],
                y: [-25, 40, -15],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            />

            {/* Blob 2: Center-right violet drift */}
            <motion.div
              className="absolute w-[550px] h-[550px] rounded-full blur-3xl opacity-10 top-12 right-1/4"
              style={{
                background: "radial-gradient(circle, #4F46E5 0%, #6366F1 50%, transparent 80%)",
              }}
              animate={{
                x: [40, -50, 30],
                y: [30, -35, 20],
              }}
              transition={{
                duration: 24,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: 2,
              }}
            />

            {/* Blob 3: Bottom-center soft glow */}
            <motion.div
              className="absolute w-[440px] h-[440px] rounded-full blur-3xl opacity-8 bottom-0 left-1/3"
              style={{
                background: "radial-gradient(circle, #818CF8 0%, #A5B4FC 60%, transparent 80%)",
              }}
              animate={{
                x: [-30, 35, -10],
                y: [20, -25, 15],
              }}
              transition={{
                duration: 22,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: 4,
              }}
            />
          </>
        ) : (
          /* Static subtle tint for reduced motion users */
          <div
            className="absolute w-[550px] h-[550px] rounded-full blur-3xl opacity-10 top-10 left-1/3"
            style={{
              background: "radial-gradient(circle, #5B5FEF 0%, transparent 70%)",
            }}
          />
        )}

        {/* Layer 2: Faint dot-grid texture with radial mask fading out */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(#4F46E5 0.85px, transparent 0.85px)",
            backgroundSize: "24px 24px",
            maskImage:
              "radial-gradient(ellipse 65% 55% at 50% 45%, black 20%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 65% 55% at 50% 45%, black 20%, transparent 80%)",
          }}
        />
      </div>

      {/* --- Hero Content --- */}
      <div className="max-w-3xl mx-auto relative z-10 flex flex-col items-center">
        {/* Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeCustom }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-7"
          style={{
            backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            color: "var(--primary)",
            border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
          }}
        >
          <Sparkles size={13} className="text-primary" />
          <span>Your calm, in one place</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: easeCustom }}
          className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight text-foreground leading-[1.08] mb-6"
          style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
        >
          Never miss a bill again.
          <span className="block italic text-muted-foreground font-light text-2xl sm:text-3xl md:text-4xl mt-2 tracking-normal">
            Less mental load. More room to live.
          </span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: easeCustom }}
          className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-xl mb-9"
        >
          Duewell quietly keeps your payments in check, predicts upcoming cash flow, and dispatches proactive reminders — so you can spend your attention elsewhere.
        </motion.p>

        {/* Dual CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22, ease: easeCustom }}
          className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
        >
          <button
            onClick={() => navigate("/auth?tab=signup")}
            className="primary-button w-full sm:w-auto px-7 py-3 text-sm font-semibold shadow-sm flex items-center justify-center gap-2"
          >
            <span>Get started free</span>
            <ArrowRight size={15} />
          </button>

          <button
            onClick={() => navigate("/auth?tab=login")}
            className="secondary-button w-full sm:w-auto px-6 py-3 text-sm font-semibold"
          >
            Sign in
          </button>
        </motion.div>
      </div>
    </section>
  );
}

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Home,
  LayoutDashboard,
  MessageCircle,
  Moon,
  Receipt,
  Search,
  Wallet,
  Zap,
} from "lucide-react";
import DuewellLogo from "../components/DuewellLogo";
import { useAuth } from "../contexts/AuthContext";

type BillStatus = "overdue" | "due-soon" | "paid";
type BillPreview = {
  id: number;
  biller: string;
  category: string;
  amount: number;
  dueDate: string;
  status: BillStatus;
  initials: string;
  accent: string;
};

const seededBills: BillPreview[] = [
  { id: 1, biller: "Airtel Broadband", category: "Internet", amount: 1299, dueDate: "Sep 21", status: "due-soon", initials: "AB", accent: "#e84645" },
  { id: 2, biller: "HDFC Bank", category: "Credit card", amount: 18420, dueDate: "Sep 18", status: "overdue", initials: "HB", accent: "#e85f3f" },
  { id: 3, biller: "MSEDCL", category: "Electricity", amount: 2430, dueDate: "Sep 24", status: "due-soon", initials: "MS", accent: "#4f7dff" },
  { id: 4, biller: "Netflix", category: "Subscriptions", amount: 649, dueDate: "Sep 27", status: "due-soon", initials: "N", accent: "#d9364a" },
  { id: 5, biller: "LIC Premium", category: "Insurance", amount: 5600, dueDate: "Oct 04", status: "paid", initials: "L", accent: "#e3b94a" },
  { id: 6, biller: "Pune Municipal", category: "Property tax", amount: 3200, dueDate: "Oct 09", status: "paid", initials: "PM", accent: "#2e9a73" },
];

function PublicNav() {
  const navigate = useNavigate();
  return (
    <motion.header
      className="public-nav"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <DuewellLogo onClick={() => navigate("/")} />
      <nav className="public-nav-links">
        <a href="#how-it-works">How it works</a>
        <a href="#features">Features</a>
        <a href="#calm">Why Duewell</a>
      </nav>
      <div className="public-nav-actions">
        <button className="public-text-link" onClick={() => navigate("/auth?mode=login")}>
          Sign in
        </button>
        <button className="primary-button" onClick={() => navigate("/auth?mode=signup")}>
          Get started <ArrowRight size={15} />
        </button>
      </div>
    </motion.header>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.name ? user.name.trim().split(" ")[0] : "there";
  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "DW";
  const previewRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: previewRef, offset: ["start end", "center center"] });
  const previewScale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const previewY = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const reveal = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };
  const prefersReducedMotion = useReducedMotion();
  const blobTransition = (duration: number, delay: number) => ({
    duration,
    delay,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
  });

  return (
    <div className="public-page">
      <PublicNav />
      <main>
        <section className="landing-hero">
          <div className="hero-ambient" aria-hidden="true">
            <span className="hero-dot-grid" />
            <motion.span
              className="hero-blob hero-blob-one"
              animate={prefersReducedMotion ? undefined : { x: [0, 56, -24, 0], y: [0, -34, 42, 0] }}
              transition={blobTransition(21, 0)}
            />
            <motion.span
              className="hero-blob hero-blob-two"
              animate={prefersReducedMotion ? undefined : { x: [0, -48, 28, 0], y: [0, 38, -26, 0] }}
              transition={blobTransition(18, 1.8)}
            />
            <motion.span
              className="hero-blob hero-blob-three"
              animate={prefersReducedMotion ? undefined : { x: [0, 28, -44, 0], y: [0, 48, 18, 0] }}
              transition={blobTransition(24, 3.2)}
            />
          </div>
          <div className="hero-content">
            <div className="hero-kicker">
              <span className="hero-kicker-dot" /> Your calm, in one place
            </div>
            <motion.h1 initial="hidden" animate="show" variants={reveal} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              Never miss a bill.
              <br />
              <em>Keep your head clear.</em>
            </motion.h1>
            <motion.p
              className="hero-copy"
              initial="hidden"
              animate="show"
              variants={reveal}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              Duewell keeps every payment, reminder, and receipt quietly in view — so your attention can stay on the things that matter.
            </motion.p>
            <motion.div
              className="hero-actions"
              initial="hidden"
              animate="show"
              variants={reveal}
              transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <button className="primary-button hero-button" onClick={() => navigate("/auth?mode=signup")}>
                Get started <ArrowRight size={16} />
              </button>
              <button className="secondary-button hero-button" onClick={() => navigate("/auth?mode=login")}>
                Sign in
              </button>
            </motion.div>
            <motion.div className="hero-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.5 }}>
              <CheckCircle2 size={15} /> Built for a little less mental load
            </motion.div>
          </div>
        </section>

        <section className="preview-section" ref={previewRef}>
          <motion.div className="product-preview" style={{ scale: previewScale, y: previewY }}>
            <div className="preview-browser-bar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <div className="preview-url">app.duewell.co/overview</div>
              <span className="preview-lock">
                <Check size={11} />
              </span>
            </div>
            <div className="preview-body">
              <aside className="preview-sidebar">
                <DuewellLogo />
                <p className="eyebrow">Workspace</p>
                <div className="preview-nav active">
                  <LayoutDashboard size={13} /> Overview
                </div>
                <div className="preview-nav">
                  <Receipt size={13} /> Bills
                </div>
                <div className="preview-nav">
                  <Home size={13} /> Calendar
                </div>
                <p className="eyebrow preview-tools">Tools</p>
                <div className="preview-nav">
                  <MessageCircle size={13} /> Ask Duewell
                </div>
                <div className="preview-reminder">
                  <Zap size={13} />
                  <strong>Smart reminders</strong>
                  <small>Next reminder tomorrow at 9:00 AM.</small>
                </div>
              </aside>
              <div className="preview-main">
                <div className="preview-topbar">
                  <div className="preview-search">
                    <Search size={12} /> Search bills
                  </div>
                  <div className="preview-top-icons">
                    <Moon size={13} />
                    <Bell size={13} />
                    <span>{initials}</span>
                  </div>
                </div>
                <div className="preview-content">
                  <p className="eyebrow">Friday, September 18, 2026</p>
                  <h2>Good evening, {displayName}</h2>
                  <p className="preview-subtitle">A clear view of what’s coming up — and what can wait.</p>
                  <div className="preview-stats">
                    <div>
                      <span className="preview-chip indigo">
                        <CircleDollarSign size={13} />
                      </span>
                      <small>Outstanding</small>
                      <strong>₹22,798</strong>
                      <em>across 4 upcoming bills</em>
                    </div>
                    <div>
                      <span className="preview-chip amber">
                        <Bell size={13} />
                      </span>
                      <small>Due this week</small>
                      <strong>3</strong>
                      <em>Next: Airtel on Sep 21</em>
                    </div>
                    <div>
                      <span className="preview-chip coral">
                        <Zap size={13} />
                      </span>
                      <small>Needs attention</small>
                      <strong>1</strong>
                      <em>HDFC card · 2 days late</em>
                    </div>
                  </div>
                  <div className="preview-bills-heading">
                    <div>
                      <h3>Your bills</h3>
                      <p>Keep an eye on the next few dates.</p>
                    </div>
                    <span onClick={() => navigate("/auth?mode=login")} style={{ cursor: "pointer" }}>
                      View all <ArrowRight size={11} />
                    </span>
                  </div>
                  <div className="preview-bills">
                    {seededBills.slice(0, 3).map((bill) => (
                      <div className="preview-bill" key={bill.id}>
                        <div className="preview-bill-top">
                          <span style={{ background: `${bill.accent}16`, color: bill.accent }}>{bill.initials}</span>
                          <small>{bill.category}</small>
                        </div>
                        <strong>{bill.biller}</strong>
                        <div>
                          <b>₹{bill.amount.toLocaleString("en-IN")}</b>
                          <em className={`preview-status ${bill.status}`}>{bill.status === "overdue" ? "Overdue" : "Due soon"}</em>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-intro">
            <p className="eyebrow">Designed to disappear into your day</p>
            <h2>
              Everything handled.
              <br />
              <em>Nothing hovering over you.</em>
            </h2>
          </div>
          <motion.div
            className="feature-grid"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.22 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          >
            {[
              {
                icon: <Bell size={19} />,
                tone: "amber",
                title: "Smart reminders",
                body: "The right nudge at the right moment. Never noisy, never too late.",
              },
              {
                icon: <Bot size={19} />,
                tone: "indigo",
                title: "Ask Duewell",
                body: "A helpful AI assistant that knows your bills and keeps answers simple.",
              },
              {
                icon: <Receipt size={19} />,
                tone: "mint",
                title: "One view of every bill",
                body: "See what’s due, what’s paid, and what deserves your attention next.",
              },
            ].map((feature) => (
              <motion.article
                className="feature-card"
                key={feature.title}
                variants={reveal}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className={`feature-icon ${feature.tone}`}>{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                <span className="feature-arrow">
                  <ArrowRight size={15} />
                </span>
              </motion.article>
            ))}
          </motion.div>
        </section>

        <section className="closing-cta" id="calm">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="closing-mark">
              <Wallet size={18} />
            </span>
            <p className="eyebrow">A softer way to stay on top of life</p>
            <h2>
              Ready to make room
              <br />
              for more important things?
            </h2>
            <button className="primary-button" onClick={() => navigate("/auth?mode=signup")}>
              Get started with Duewell <ArrowRight size={15} />
            </button>
          </motion.div>
        </section>
      </main>

      <footer className="public-footer">
        <DuewellLogo onClick={() => navigate("/")} />
        <p>© 2026 Duewell. Bill companion for calmer days.</p>
        <div>
          <a href="#features">Features</a>
          <button type="button" onClick={() => navigate("/auth")}>Sign in</button>
        </div>
      </footer>
    </div>
  );
}

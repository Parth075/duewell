import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  Home,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Moon,
  Paperclip,
  Plus,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Sun,
  Upload,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

type BillStatus = "overdue" | "due-soon" | "paid";
type Bill = {
  id: number;
  biller: string;
  category: string;
  amount: number;
  dueDate: string;
  status: BillStatus;
  initials: string;
  accent: string;
  account: string;
  autopay: boolean;
  note?: string;
};

type ChatMessage = { role: "user" | "assistant"; text: string };

const seededBills: Bill[] = [
  { id: 1, biller: "Airtel Broadband", category: "Internet", amount: 1299, dueDate: "Sep 21", status: "due-soon", initials: "AB", accent: "#e84645", account: "•••• 4820", autopay: false, note: "Your plan renews monthly." },
  { id: 2, biller: "HDFC Bank", category: "Credit card", amount: 18420, dueDate: "Sep 18", status: "overdue", initials: "HB", accent: "#e85f3f", account: "•••• 8041", autopay: false, note: "Minimum due ₹1,840." },
  { id: 3, biller: "MSEDCL", category: "Electricity", amount: 2430, dueDate: "Sep 24", status: "due-soon", initials: "MS", accent: "#4f7dff", account: "•••• 1129", autopay: true, note: "Average monthly bill ₹2,210." },
  { id: 4, biller: "Netflix", category: "Subscriptions", amount: 649, dueDate: "Sep 27", status: "due-soon", initials: "N", accent: "#d9364a", account: "•••• 2118", autopay: true, note: "Premium plan." },
  { id: 5, biller: "LIC Premium", category: "Insurance", amount: 5600, dueDate: "Oct 04", status: "paid", initials: "L", accent: "#e3b94a", account: "•••• 0914", autopay: false, note: "Paid on Sep 03." },
  { id: 6, biller: "Pune Municipal", category: "Property tax", amount: 3200, dueDate: "Oct 09", status: "paid", initials: "PM", accent: "#2e9a73", account: "•••• 7302", autopay: false, note: "Receipt saved." },
];

const navItems = [
  { label: "Overview", icon: LayoutDashboard, path: "/overview" },
  { label: "Bills", icon: Receipt, path: "/overview/bills" },
  { label: "Calendar", icon: Home, path: "/overview/calendar" },
];

export function apiRequest(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" switchable>
      <BrowserRouter>
        <Toaster position="bottom-right" richColors />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/overview/*" element={<BillReminderApp />} />
          <Route path="/login" element={<Navigate to="/auth?tab=login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function BillReminderApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  // Read the logged-in user from localStorage (set in AuthPage on login/signup)
  const storedUser = (() => { try { const u = localStorage.getItem("duewell_user"); return u ? JSON.parse(u) : null; } catch { return null; } })();
  const userName = storedUser?.name || storedUser?.email?.split("@")[0] || "Alex";
  const userInitials = userName.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "AS";
  const [bills, setBills] = useState<Bill[]>(seededBills);
  const [reminders, setReminders] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | BillStatus>("all");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(3);
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: `Hi ${userName} — I can help you stay ahead of your bills. What would you like to check?` },
  ]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatTyping, setChatTyping] = useState(false);

  const filteredBills = useMemo(() => bills.filter((bill) => {
    const matchesFilter = activeFilter === "all" || bill.status === activeFilter;
    const matchesQuery = `${bill.biller} ${bill.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  }), [bills, activeFilter, query]);

  const totals = useMemo(() => ({
    owed: bills.filter((b) => b.status !== "paid").reduce((sum, b) => sum + b.amount, 0),
    dueSoon: bills.filter((b) => b.status === "due-soon").length,
    overdue: bills.filter((b) => b.status === "overdue").length,
  }), [bills]);

  const loadBills = () => {
    apiRequest("/bills").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload) && payload.length) setBills(payload);
    }).catch(() => undefined);
  };

  const loadReminders = () => {
    apiRequest("/reminders").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload) && payload.length) setReminders(payload);
    }).catch(() => undefined);
  };

  useEffect(() => {
    loadBills();
    loadReminders();
  }, [location.pathname]);

  const markPaid = async (billId: number) => {
    setBills((current) => current.map((bill) => bill.id === billId ? { ...bill, status: "paid" } : bill));
    toast.success("Bill marked as paid", { description: "Nice work staying on top of it." });
    try {
      await apiRequest(`/bills/${billId}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
      loadBills();
    } catch { /* best effort */ }
    setSelectedBill(null);
  };

  const triggerReminder = async (billId: number) => {
    try {
      toast.info("Analyzing reminder schedule with AI…");
      const userParam = storedUser?.email ? `?recipient_email=${encodeURIComponent(storedUser.email)}` : "";
      const res = await apiRequest(`/bills/${billId}/trigger-reminder${userParam}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const msg = data.reminder?.message || "Reminder sent successfully";
        if (data.channel === "email") {
          toast.success(`Email dispatched to ${data.recipient || "your inbox"}!`, { description: msg });
        } else if (data.error) {
          toast.warning("SMTP Error: " + data.error, { description: "Check your Gmail App Password in Render." });
        } else if (data.reason) {
          toast.info("In-app reminder scheduled", { description: data.reason });
        } else {
          toast.success("Reminder scheduled!", { description: msg });
        }
        setUnread((prev) => prev + 1);
        loadReminders();
      } else {
        toast.error("Could not trigger reminder");
      }
    } catch (e) {
      toast.error("Failed to trigger reminder");
    }
  };

  const submitChat = async (message: string) => {
    if (!message.trim()) return;
    setChatMessages((current) => [...current, { role: "user", text: message }]);
    setChatDraft("");
    setChatTyping(true);
    try {
      const response = await apiRequest("/chat", { method: "POST", body: JSON.stringify({ message }) });
      if (response.ok) {
        const data = await response.json();
        setChatMessages((current) => [...current, { role: "assistant", text: data.reply || "I’m on it — your bill data is looking healthy." }]);
      } else throw new Error("demo fallback");
    } catch {
      window.setTimeout(() => setChatMessages((current) => [...current, { role: "assistant", text: "You’re in good shape. You have 2 bills due this week, and your total outstanding balance is ₹22,798." }]), 600);
    } finally {
      window.setTimeout(() => setChatTyping(false), 650);
    }
  };

  const openAdd = () => setAddOpen(true);

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <div className="app-grain" aria-hidden="true" />
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="flex items-center justify-between gap-3 px-5 py-6 lg:px-7">
          <button className="brand-lockup" onClick={() => navigate("/overview")} aria-label="Go to overview">
            <span className="brand-mark"><Wallet size={18} strokeWidth={2.2} /></span>
            <span><strong>Duewell</strong><small>bill companion</small></span>
          </button>
          <button className="icon-button lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="px-4 lg:px-5">
          <p className="eyebrow mb-3 px-3">Workspace</p>
          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon, path }) => {
              const active = location.pathname === path || (path !== "/overview" && location.pathname.startsWith(path));
              return <button key={label} className={`nav-item ${active ? "nav-item-active" : ""}`} onClick={() => { navigate(path); setMobileNavOpen(false); }}><Icon size={17} /><span>{label}</span>{active && <motion.span layoutId="nav-dot" className="nav-dot" />}</button>;
            })}
          </nav>
          <p className="eyebrow mb-3 mt-9 px-3">Tools</p>
          <button className="nav-item" onClick={() => { setChatOpen(true); setMobileNavOpen(false); }}><MessageCircle size={17} /><span>Ask Duewell</span><span className="nav-kicker">AI</span></button>
          <button className="nav-item" onClick={() => toast.info("Settings are coming soon.")}><Settings size={17} /><span>Settings</span></button>
        </div>
        <div className="sidebar-bottom mx-4 mb-5 mt-auto rounded-2xl p-4 lg:mx-5">
          <div className="mb-3 flex items-center gap-2"><span className="status-orb"><Zap size={13} fill="currentColor" /></span><span className="text-xs font-semibold tracking-wide text-foreground">Smart reminders</span></div>
          <p className="text-xs leading-5 text-muted-foreground">Automated sweeps active. Real-time Gemini alerts enabled.</p>
          <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => toast.success("Reminder preferences up to date")}>Manage alerts <ArrowRight size={13} /></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="flex items-center gap-3"><button className="icon-button lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="lg:hidden"><span className="text-sm font-bold tracking-tight">Duewell</span></div></div>
          <div className="topbar-actions">
            <div className="search-wrap hidden md:flex"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bills" aria-label="Search bills" /><kbd>⌘ K</kbd></div>
            <button className="icon-button" onClick={toggleTheme} aria-label="Toggle dark mode">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
            <div className="relative"><button className="icon-button notification-button" onClick={() => { setNotificationsOpen((open) => !open); setUnread(0); }} aria-label="Open notifications"><Bell size={17} />{unread > 0 && <span className="notification-badge">{unread}</span>}</button>{notificationsOpen && <NotificationPanel reminders={reminders} />}</div>
            <div className="profile-chip"><span className="avatar">{userInitials}</span><span className="hidden text-left sm:block"><strong>{userName}</strong><small>Personal</small></span><ChevronRight size={14} className="hidden text-muted-foreground sm:block" /></div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route index element={<DashboardPage bills={bills} filteredBills={filteredBills} totals={totals} query={query} setQuery={setQuery} activeFilter={activeFilter} setActiveFilter={setActiveFilter} onAdd={openAdd} onSelect={setSelectedBill} onMarkPaid={markPaid} />} />
            <Route path="bills" element={<DashboardPage bills={bills} filteredBills={filteredBills} totals={totals} query={query} setQuery={setQuery} activeFilter={activeFilter} setActiveFilter={setActiveFilter} onAdd={openAdd} onSelect={setSelectedBill} onMarkPaid={markPaid} showAll />} />
            <Route path="calendar" element={<CalendarPage bills={bills} onSelect={setSelectedBill} />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      <AnimatePresence>{selectedBill && <BillDetail bill={selectedBill} onClose={() => setSelectedBill(null)} onMarkPaid={markPaid} onTriggerReminder={triggerReminder} />}</AnimatePresence>
      <AnimatePresence>{addOpen && <AddBillModal onClose={() => setAddOpen(false)} onAdd={(bill) => { setBills((current) => [bill, ...current]); setAddOpen(false); loadBills(); toast.success("Bill added", { description: `${bill.biller} is now on your radar.` }); }} />}</AnimatePresence>
      <AnimatePresence>{chatOpen && <ChatPanel messages={chatMessages} draft={chatDraft} setDraft={setChatDraft} typing={chatTyping} onClose={() => setChatOpen(false)} onSubmit={submitChat} />}</AnimatePresence>
    </div>
  );
}

function PageFrame({ children, eyebrow, title, subtitle, action }: { children: React.ReactNode; eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <motion.div className="page-frame" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25, ease: [0.23, 1, 0.32, 1] }}><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>{children}</motion.div>;
}

function DashboardPage({ bills, filteredBills, totals, query, setQuery, activeFilter, setActiveFilter, onAdd, onSelect, onMarkPaid, showAll = false }: { bills: Bill[]; filteredBills: Bill[]; totals: { owed: number; dueSoon: number; overdue: number }; query: string; setQuery: (value: string) => void; activeFilter: "all" | BillStatus; setActiveFilter: (value: "all" | BillStatus) => void; onAdd: () => void; onSelect: (bill: Bill) => void; onMarkPaid: (id: number) => void; showAll?: boolean }) {
  return <PageFrame eyebrow="Friday, September 18, 2026" title="Good evening, Alex" subtitle="A clear view of what’s coming up — and what can wait." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Add a bill</button>}>
    <div className="summary-grid">
      <SummaryCard label="Outstanding" value={`₹${totals.owed.toLocaleString("en-IN")}`} meta="across 4 upcoming bills" icon={<CircleDollarSign size={19} />} tone="primary" chart />
      <SummaryCard label="Due this week" value={String(totals.dueSoon)} meta="Next: Airtel on Sep 21" icon={<Bell size={18} />} tone="amber" />
      <SummaryCard label="Needs attention" value={String(totals.overdue)} meta="HDFC card · 2 days late" icon={<Zap size={18} />} tone="red" />
    </div>
    <section className="section-block mt-9">
      <div className="section-header"><div><h2>{showAll ? "All bills" : "Your bills"}</h2><p>{showAll ? "Every bill in one place." : "Keep an eye on the next few dates."}</p></div><button className="text-button" onClick={() => setActiveFilter("all")}>View all <ArrowRight size={14} /></button></div>
      <div className="filter-row"><div className="filter-tabs">{([["all", "All"], ["due-soon", "Due soon"], ["overdue", "Overdue"], ["paid", "Paid"]] as const).map(([value, label]) => <button key={value} className={activeFilter === value ? "filter-tab-active" : ""} onClick={() => setActiveFilter(value)}>{label}{value !== "all" && <span>{bills.filter((bill) => bill.status === value).length}</span>}</button>)}</div><div className="search-wrap md:hidden"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bills" aria-label="Search bills" /></div><button className="filter-button hidden sm:flex" onClick={() => toast.info("Filters are ready for your backend data.")}><Filter size={15} /> Filters</button></div>
      {filteredBills.length ? <motion.div className="bill-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: .055 } } }}>{filteredBills.slice(0, showAll ? undefined : 5).map((bill) => <BillCard key={bill.id} bill={bill} onSelect={onSelect} onMarkPaid={onMarkPaid} />)}</motion.div> : <EmptyState onAdd={onAdd} />}
    </section>
    <section className="insight-banner mt-8"><div className="insight-icon"><Sparkles size={18} /></div><div><p className="eyebrow">Duewell insight</p><p className="insight-text">You’ve paid <strong>₹8,800</strong> this month. That’s 18% less than your average — nice rhythm.</p></div><button className="icon-button ml-auto" onClick={() => toast.info("Insights are generated from your payment history.")}><MoreHorizontal size={17} /></button></section>
  </PageFrame>;
}

function SummaryCard({ label, value, meta, icon, tone, chart }: { label: string; value: string; meta: string; icon: React.ReactNode; tone: string; chart?: boolean }) {
  return <motion.div className="summary-card" whileHover={{ y: -2 }} transition={{ duration: .16 }}><div className={`summary-icon ${tone}`}>{icon}</div><div className="summary-card-main"><p>{label}</p><strong>{value}</strong><span>{meta}</span></div>{chart && <div className="mini-chart" aria-label="Balance trend"><i style={{ height: "32%" }} /><i style={{ height: "48%" }} /><i style={{ height: "42%" }} /><i style={{ height: "68%" }} /><i style={{ height: "58%" }} /><i style={{ height: "80%" }} /><i style={{ height: "72%" }} /></div>}</motion.div>;
}

function BillCard({ bill, onSelect, onMarkPaid }: { bill: Bill; onSelect: (bill: Bill) => void; onMarkPaid: (id: number) => void }) {
  const status = statusMeta(bill.status);
  return <motion.article className={`bill-card ${bill.status === "overdue" ? "bill-card-alert" : ""}`} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -3 }} transition={{ duration: .16 }} onClick={() => onSelect(bill)}><div className="bill-card-top"><div className="biller-mark" style={{ backgroundColor: `${bill.accent}16`, color: bill.accent }}>{bill.initials}</div><button className="icon-button tiny" onClick={(event) => { event.stopPropagation(); toast.info(`${bill.biller} options`); }} aria-label={`More options for ${bill.biller}`}><MoreHorizontal size={16} /></button></div><div className="mt-5 flex items-start justify-between gap-3"><div><h3>{bill.biller}</h3><p>{bill.category}</p></div><span className={`status-pill ${status.className}`}>{status.icon}{status.label}</span></div><div className="bill-card-bottom"><div><span className="amount">₹{bill.amount.toLocaleString("en-IN")}</span><span className="due-date">{bill.status === "paid" ? "Paid Sep 03" : `Due ${bill.dueDate}`}</span></div>{bill.status !== "paid" && <button className="mark-button" onClick={(event) => { event.stopPropagation(); onMarkPaid(bill.id); }}><Check size={14} /> Mark paid</button>}</div></motion.article>;
}

function statusMeta(status: BillStatus) {
  if (status === "overdue") return { label: "Overdue", className: "status-red", icon: <span className="status-dot" /> };
  if (status === "paid") return { label: "Paid", className: "status-green", icon: <CheckCircle2 size={13} /> };
  return { label: "Due soon", className: "status-amber", icon: <span className="status-dot" /> };
}

function EmptyState({ onAdd }: { onAdd: () => void }) { return <div className="empty-state"><div className="empty-orbit"><Receipt size={26} /></div><h3>No bills match that filter</h3><p>Try another view, or add a new bill to start your list.</p><button className="primary-button" onClick={onAdd}><Plus size={16} /> Add a bill</button></div>; }

function NotificationPanel({ reminders }: { reminders: any[] }) {
  const displayReminders = reminders && reminders.length > 0 ? reminders.slice(0, 5) : [
    { message: "Airtel due in 3 days - Reminder scheduled for tomorrow at 9:00 AM.", status: "due-soon" },
    { message: "HDFC card needs attention - Your payment is 2 days overdue.", status: "overdue" },
    { message: "LIC marked as paid - Receipt saved to your payment history.", status: "paid" },
  ];

  return (
    <motion.div className="notification-panel" initial={{ opacity: 0, y: -5, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
      <div className="flex items-center justify-between">
        <div><p className="eyebrow">Inbox</p><h3>Recent reminders</h3></div>
        <span className="text-xs text-muted-foreground">Live SQLite</span>
      </div>
      {displayReminders.map((item: any, idx: number) => {
        const isOverdue = (item.message || "").toLowerCase().includes("overdue");
        const isPaid = (item.message || "").toLowerCase().includes("paid");
        const tone = isOverdue ? "red" : isPaid ? "green" : "amber";
        return (
          <div className="notification-item" key={item.id || idx}>
            <span className={`notification-symbol ${tone}`}>
              {isOverdue ? <Zap size={15} /> : isPaid ? <Check size={15} /> : <Bell size={15} />}
            </span>
            <div>
              <strong>{item.message?.split(" - ")[0] || item.message}</strong>
              <p>{item.message?.split(" - ")[1] || item.reminder_date || "Reminder active"}</p>
            </div>
          </div>
        );
      })}
      <button className="text-button mt-2 w-full justify-center" onClick={() => toast.info("Notification center is in sync with backend scheduler.")}>
        View notification center <ArrowRight size={14} />
      </button>
    </motion.div>
  );
}

function BillDetail({ bill, onClose, onMarkPaid, onTriggerReminder }: { bill: Bill; onClose: () => void; onMarkPaid: (id: number) => void; onTriggerReminder: (id: number) => void }) {
  const status = statusMeta(bill.status);
  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside className="detail-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: .28, ease: [0.23, 1, 0.32, 1] }} onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <button className="icon-button" onClick={onClose} aria-label="Close bill details"><X size={18} /></button>
          <div className="flex items-center gap-2">
            <button className="icon-button" onClick={() => toast.info("Share link copied")}><ArrowRight size={16} /></button>
            <button className="icon-button" onClick={() => toast.info("Options")}><MoreHorizontal size={17} /></button>
          </div>
        </div>
        <div className="drawer-content">
          <div className="detail-brand" style={{ color: bill.accent, backgroundColor: `${bill.accent}16` }}>{bill.initials}</div>
          <div className="mt-5 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{bill.category}</p>
              <h2>{bill.biller}</h2>
              <p className="text-sm text-muted-foreground">{bill.account}</p>
            </div>
            <span className={`status-pill ${status.className}`}>{status.icon}{status.label}</span>
          </div>
          <div className="detail-amount">
            <span>Amount due</span>
            <strong>₹{bill.amount.toLocaleString("en-IN")}</strong>
            <small>{bill.status === "paid" ? "Paid" : `Due ${bill.dueDate}, 2026`}</small>
          </div>
          {bill.status !== "paid" && (
            <div className="flex flex-col gap-2 mt-4">
              <button className="primary-button w-full justify-center" onClick={() => onMarkPaid(bill.id)}>
                <CheckCircle2 size={17} /> Mark as paid
              </button>
              <button className="secondary-button w-full justify-center" onClick={() => onTriggerReminder(bill.id)}>
                <Zap size={16} /> Trigger on-demand reminder
              </button>
            </div>
          )}
          <div className="detail-section">
            <div className="section-header"><h3>Payment history</h3><span className="text-xs text-muted-foreground">Recent</span></div>
            <div className="timeline">
              <TimelineItem label="Current cycle" detail={`₹${bill.amount.toLocaleString("en-IN")} · ${bill.status}`} done />
              <TimelineItem label="Reminder trigger" detail="AI agent ready to dispatch" done last />
            </div>
          </div>
          <div className="detail-note">
            <FileText size={17} />
            <div><strong>Bill note</strong><p>{bill.note || "No specific notes recorded."}</p></div>
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function TimelineItem({ label, detail, done, last }: { label: string; detail: string; done?: boolean; last?: boolean }) {
  return <div className="timeline-item"><span className={`timeline-dot ${done ? "done" : ""}`}><Check size={11} /></span><div><strong>{label}</strong><p>{detail}</p></div>{!last && <span className="timeline-line" />}</div>;
}

function AddBillModal({ onClose, onAdd }: { onClose: () => void; onAdd: (bill: Bill) => void }) {
  const [tab, setTab] = useState<"manual" | "upload">("manual");
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({ biller: "", amount: "", dueDate: "", category: "", account: "", note: "" });
  const [fileName, setFileName] = useState("");
  const valid = form.biller && form.amount && form.dueDate;

  const create = async () => {
    if (!valid) return toast.error("Add a biller, amount, and due date first.");
    try {
      const res = await apiRequest("/bills", {
        method: "POST",
        body: JSON.stringify({
          biller: form.biller,
          category: form.category || "Other",
          amount: Number(form.amount),
          dueDate: form.dueDate,
          status: "due-soon",
          account: form.account || "•••• 0000",
          autopay: false,
          note: form.note || ""
        })
      });
      if (res.ok) {
        const saved = await res.json();
        onAdd(saved);
        return;
      }
    } catch (err) {
      console.error(err);
    }
    // Fallback in-memory
    onAdd({
      id: Date.now(),
      biller: form.biller,
      category: form.category || "Other",
      amount: Number(form.amount),
      dueDate: form.dueDate,
      status: "due-soon",
      initials: form.biller.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase(),
      accent: "#5570d9",
      account: form.account || "•••• 0000",
      autopay: false,
      note: form.note
    });
  };

  const uploadWithAI = async (file: File) => {
    setFileName(file.name);
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/bills/upload`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.success && payload.data) {
          const d = payload.data;
          setForm({
            biller: d.biller || "",
            amount: String(d.amount || ""),
            dueDate: d.dueDate || "",
            category: d.category || "Utilities",
            account: d.account || "•••• 0000",
            note: d.note || ""
          });
          toast.success("Gemini extracted bill details!", { description: `${d.biller} · ₹${d.amount}` });
          return;
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload fallback used");
    } finally {
      setProcessing(false);
    }
    // Fallback draft if network error
    setForm({ biller: "MSEDCL", amount: "2430", dueDate: "Sep 24", category: "Electricity", account: "•••• 1129", note: "Average monthly bill" });
  };

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-card" initial={{ opacity: 0, scale: .97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><p className="eyebrow">New entry</p><h2>Add a bill</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close add bill dialog"><X size={18} /></button>
        </div>
        <div className="modal-tabs">
          <button className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>Manual entry</button>
          <button className={tab === "upload" ? "active" : ""} onClick={() => setTab("upload")}><Sparkles size={14} /> Upload with AI</button>
        </div>
        {tab === "upload" && !fileName && (
          <label className="drop-zone">
            <input type="file" accept="image/*,.pdf" onChange={(event) => event.target.files?.[0] && uploadWithAI(event.target.files[0])} />
            <span className="upload-icon"><Upload size={19} /></span>
            <strong>Drop a bill here, or browse</strong>
            <small>PDF, JPG or PNG · parsed via Gemini</small>
          </label>
        )}
        {tab === "upload" && fileName && (
          <div className={`processing-card ${processing ? "is-processing" : ""}`}>
            <div className="flex items-center gap-3">
              <span className="upload-icon">{processing ? <Sparkles size={19} /> : <Check size={19} />}</span>
              <div>
                <strong>{processing ? "Gemini reading your bill…" : "AI extraction complete"}</strong>
                <p>{processing ? "Looking for amount, biller and due date." : `${fileName} · Confirm details below.`}</p>
              </div>
            </div>
            {processing && <div className="processing-bar"><span /></div>}
          </div>
        )}
        {(tab === "manual" || fileName) && (
          <div className="form-grid">
            <label><span>Biller name</span><input value={form.biller} onChange={(event) => setForm({ ...form, biller: event.target.value })} placeholder="e.g. Airtel Broadband" /></label>
            <label><span>Amount</span><div className="input-prefix"><b>₹</b><input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" /></div></label>
            <label><span>Due date</span><input value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} placeholder="e.g. Sep 28" /></label>
            <label><span>Category <em>optional</em></span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="e.g. Utilities" /></label>
          </div>
        )}
        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={create} disabled={!valid || processing}>{tab === "upload" ? "Confirm & save" : "Save bill"}<ArrowRight size={15} /></button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChatPanel({ messages, draft, setDraft, typing, onClose, onSubmit }: { messages: ChatMessage[]; draft: string; setDraft: (value: string) => void; typing: boolean; onClose: () => void; onSubmit: (message: string) => void }) { return <motion.div className="chat-panel" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: .28, ease: [0.23, 1, 0.32, 1] }}><div className="chat-header"><div className="flex items-center gap-3"><span className="chat-avatar"><Bot size={19} /></span><div><strong>Ask Duewell</strong><small><span className="live-dot" /> Online</small></div></div><button className="icon-button" onClick={onClose} aria-label="Close assistant"><X size={18} /></button></div><div className="chat-body"><div className="chat-intro"><span className="chat-intro-icon"><Sparkles size={17} /></span><p>Ask me about your bills, upcoming payments, or ways to keep things simple.</p></div>{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}><span>{message.text}</span></div>)}{typing && <div className="chat-message assistant"><span className="typing"><i /><i /><i /></span></div>}</div><div className="chat-suggestions"><button onClick={() => onSubmit("What’s due this week?")}>What’s due this week?</button><button onClick={() => onSubmit("How much have I paid?")}>Payment summary</button></div><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(draft); }}><button type="button" className="icon-button tiny" onClick={() => toast.info("Attachments are coming soon.")} aria-label="Attach a file"><Paperclip size={16} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask anything…" /><button type="submit" className="send-button" aria-label="Send message"><ArrowRight size={16} /></button></form></motion.div>; }

function CalendarPage({ bills, onSelect }: { bills: Bill[]; onSelect: (bill: Bill) => void }) { return <PageFrame eyebrow="September 2026" title="Payment calendar" subtitle="A calmer way to see the month ahead."><div className="calendar-layout"><div className="calendar-card"><div className="calendar-toolbar"><button className="icon-button"><ChevronRight size={17} className="rotate-180" /></button><h2>September 2026</h2><button className="icon-button"><ChevronRight size={17} /></button></div><div className="week-labels">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: 30 }, (_, i) => { const day = i + 1; const bill = bills.find((item) => Number(item.dueDate.replace(/\D/g, "")) === day); return <button key={day} className={`calendar-day ${day === 18 ? "today" : ""} ${bill ? "has-bill" : ""}`} onClick={() => bill && onSelect(bill)}><span>{day}</span>{bill && <i style={{ background: bill.accent }} />}</button>; })}</div></div><div className="calendar-agenda"><div className="section-header"><div><h2>Coming up</h2><p>Next 14 days</p></div><Filter size={16} className="text-muted-foreground" /></div>{bills.filter((bill) => bill.status !== "paid").slice(0, 4).map((bill) => <button className="agenda-item" key={bill.id} onClick={() => onSelect(bill)}><span className="agenda-date">{bill.dueDate.split(" ")[1] || "18"}<small>SEP</small></span><span className="agenda-copy"><strong>{bill.biller}</strong><small>{bill.category}</small></span><span className="agenda-amount">₹{bill.amount.toLocaleString("en-IN")}</span></button>)}</div></div></PageFrame>; }

function LoginPage() { const navigate = useNavigate(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const submit = async (event: React.FormEvent) => { event.preventDefault(); try { await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); } catch { /* demo mode */ } navigate("/"); }; return <div className="login-screen"><div className="login-art"><span className="brand-mark"><Wallet size={18} /></span><p className="eyebrow">A better way to remember</p><h1>Less mental load.<br /><em>More room to live.</em></h1><p>Duewell quietly keeps your payments in check, so you can spend your attention elsewhere.</p><div className="login-art-card"><div className="flex items-center justify-between"><span className="eyebrow">This week</span><span className="status-pill status-green"><CheckCircle2 size={13} /> On track</span></div><strong>2 bills due</strong><div className="art-progress"><span /></div><small>All reminders are up to date.</small></div></div><motion.form className="login-card" onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><button type="button" className="brand-lockup mb-12" onClick={() => navigate("/")}><span className="brand-mark"><Wallet size={18} /></span><span><strong>Duewell</strong><small>bill companion</small></span></button><p className="eyebrow">Welcome back</p><h2>Sign in to your calm.</h2><p className="login-subtitle">Your bills are waiting, not demanding.</p><label><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@example.com" required /></label><label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required /></label><button className="primary-button w-full justify-center" type="submit">Continue <ArrowRight size={16} /></button><p className="login-footnote">New to Duewell? <button type="button" onClick={() => toast.info("Signup is ready to connect to your auth flow.")}>Create an account</button></p></motion.form></div>; }

export default App;


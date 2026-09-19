import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, Sun, Moon } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.header
      className="landing-navbar"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="landing-nav-inner max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Brand Lockup */}
        <button
          className="brand-lockup flex items-center gap-2.5 text-left focus:outline-none"
          onClick={() => navigate("/")}
          aria-label="Duewell Home"
        >
          <span className="brand-mark">
            <Wallet size={18} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Duewell</strong>
            <small>bill companion</small>
          </span>
        </button>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-7">
          <a
            href="#features"
            className="text-xs font-semibold tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#preview"
            className="text-xs font-semibold tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          >
            Product
          </a>
          <button
            onClick={() => navigate("/overview")}
            className="text-xs font-semibold tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          >
            Live Demo
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            className="icon-button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            type="button"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            onClick={() => navigate("/auth?tab=login")}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
          >
            Sign in
          </button>

          <button
            onClick={() => navigate("/auth?tab=signup")}
            className="primary-button text-xs font-semibold px-4 py-2"
          >
            Get started
          </button>
        </div>
      </div>
    </motion.header>
  );
}

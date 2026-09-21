import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import DuewellLogo from "../components/DuewellLogo";
import { useAuth } from "../contexts/AuthContext";

function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "signup" || params.get("tab") === "signup" ? "signup" : "login";
  });
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    window.setTimeout(() => setShake(false), 460);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    // Client-side validation
    if (!form.email || !form.password || (mode === "signup" && (!form.name || !form.confirm))) {
      triggerShake("Please complete the fields above.");
      return;
    }
    if (mode === "signup" && form.password !== form.confirm) {
      triggerShake("Passwords do not match yet.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await signup(form.name, form.email, form.password);
      }
      toast.success(mode === "login" ? "Welcome back!" : "Account created!");
      // Honour redirect param if present (e.g. from RequireAuth)
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") || "/overview";
      navigate(redirect, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      triggerShake(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = (next: "login" | "signup") => {
    setMode(next);
    setError("");
    window.history.replaceState({}, "", `/auth?mode=${next}`);
  };

  return (
    <div className="auth-page">
      <div className="auth-orbit auth-orbit-one" />
      <div className="auth-orbit auth-orbit-two" />
      <div className="auth-topbar">
        <DuewellLogo onClick={() => navigate("/")} />
        <button type="button" className="public-text-link" onClick={() => navigate("/")}>
          Back to home <ArrowRight size={14} />
        </button>
      </div>

      <motion.main
        className={`auth-card ${shake ? "auth-shake" : ""}`}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <DuewellLogo onClick={() => navigate("/")} />
        <div className="auth-card-heading">
          <p className="eyebrow">{mode === "login" ? "Welcome back" : "A calmer start"}</p>
          <h1>{mode === "login" ? "Sign in to your calm." : "Create your account."}</h1>
          <p>{mode === "login" ? "Your bills are waiting, not demanding." : "A little less mental load starts here."}</p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => toggleMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => toggleMode("signup")}
          >
            Sign up
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            onSubmit={submit}
            initial={{ opacity: 0, x: mode === "login" ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === "login" ? 8 : -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {mode === "signup" && (
              <AuthField
                label="Name"
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
                placeholder="Your full name"
              />
            )}
            {mode === "signup" && <div className="auth-field-spacer" />}
            <AuthField
              label="Email address"
              type="email"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
              placeholder="you@example.com"
            />
            <AuthField
              label="Password"
              type="password"
              value={form.password}
              onChange={(value) => setForm({ ...form, password: value })}
              placeholder="••••••••"
            />
            {mode === "signup" ? (
              <AuthField
                label="Confirm password"
                type="password"
                value={form.confirm}
                onChange={(value) => setForm({ ...form, confirm: value })}
                placeholder="••••••••"
              />
            ) : (
              <div className="forgot-row">
                <span />
                <button
                  type="button"
                  onClick={() => toast.info("Password reset flow is ready to connect.")}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Please wait…"
                : mode === "login"
                ? "Continue"
                : "Create account"}{" "}
              <ArrowRight size={16} />
            </button>
          </motion.form>
        </AnimatePresence>

        <p className="auth-footnote">
          {mode === "login" ? "New to Duewell?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => toggleMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>
      </motion.main>

      <p className="auth-trust">
        <CheckCircle2 size={14} /> Your data stays yours. Always.
      </p>
    </div>
  );
}

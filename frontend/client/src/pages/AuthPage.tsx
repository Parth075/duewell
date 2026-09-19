import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import DuewellLogo from "../components/DuewellLogo";
import { apiRequest } from "../App";

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
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "signup">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "signup" || params.get("tab") === "signup" ? "signup" : "login";
  });
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.email || !form.password || (mode === "signup" && (!form.name || !form.confirm))) {
      setError("Please complete the fields above.");
      setShake(true);
      window.setTimeout(() => setShake(false), 460);
      return;
    }
    if (mode === "signup" && form.password !== form.confirm) {
      setError("Passwords do not match yet.");
      setShake(true);
      window.setTimeout(() => setShake(false), 460);
      return;
    }
    try {
      const res = await apiRequest(mode === "login" ? "/auth/login" : "/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: form.email, password: form.password, name: form.name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) localStorage.setItem("duewell_user", JSON.stringify(data.user));
        if (data.access_token) localStorage.setItem("duewell_token", data.access_token);
      } else {
        localStorage.setItem("duewell_user", JSON.stringify({ name: form.name || (mode === "login" ? "Alex Shah" : "User"), email: form.email }));
      }
    } catch {
      localStorage.setItem("duewell_user", JSON.stringify({ name: form.name || (mode === "login" ? "Alex Shah" : "User"), email: form.email }));
    }
    toast.success(mode === "login" ? "Welcome back!" : "Account created!");
    navigate("/overview");
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
                placeholder="Alex Shah"
              />
            )}
            {mode === "signup" && <div className="auth-field-spacer" />}
            <AuthField
              label="Email address"
              type="email"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
              placeholder="alex@example.com"
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

            <button className="primary-button auth-submit" type="submit">
              {mode === "login" ? "Continue" : "Create account"} <ArrowRight size={16} />
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

import { Wallet } from "lucide-react";

export default function DuewellLogo({
  onClick,
  light = false,
}: {
  onClick?: () => void;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      className={`public-logo ${light ? "public-logo-light" : ""}`}
      onClick={onClick}
      aria-label="Duewell home"
    >
      <span className="brand-mark">
        <Wallet size={18} />
      </span>
      <span>
        <strong>Duewell</strong>
        <small>bill companion</small>
      </span>
    </button>
  );
}

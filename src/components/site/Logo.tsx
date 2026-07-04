import logoAsset from "@/assets/logo-serenar.png.asset.json";

type Props = {
  className?: string;
  variant?: "full" | "mark";
};

export function Logo({ className = "h-10 w-auto", variant = "full" }: Props) {
  if (variant === "mark") {
    return (
      <span
        className={
          "inline-flex items-center gap-2 font-serif text-2xl text-sage-deep " + className
        }
      >
        <LeafMark className="h-5 w-5 text-gold" />
        <span>Serenar</span>
      </span>
    );
  }
  return (
    <img
      src={logoAsset.url}
      alt="Serenar — Massoterapia & Bem-Estar"
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}

export function LeafMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 26 C 14 22, 22 14, 26 6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M18 12 C 20 10, 23 9, 26 6 C 25 10, 23 13, 20 15 Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M13 17 C 15 15, 17 14, 19 13 C 18 16, 16 18, 14 19 Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 100);
    const t2 = setTimeout(() => setPhase("exit"), 2000);
    const t3 = setTimeout(onFinish, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[hsl(var(--dark))] transition-opacity duration-500 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Glow behind logo */}
      <div
        className={`absolute w-48 h-48 rounded-full bg-[hsl(var(--gold))] blur-[80px] opacity-30 transition-all duration-1000 ${
          phase === "enter" ? "scale-0" : "scale-100"
        }`}
      />

      {/* Logo */}
      <img
        src={logo}
        alt="Up & Down Solar"
        className={`relative w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl transition-all duration-700 ease-out ${
          phase === "enter"
            ? "scale-50 opacity-0 translate-y-8"
            : "scale-100 opacity-100 translate-y-0"
        }`}
      />

      {/* App name */}
      <h1
        className={`relative mt-6 font-barlow text-2xl sm:text-3xl font-bold tracking-wide text-[hsl(var(--gold-bright))] transition-all duration-700 delay-300 ${
          phase === "enter"
            ? "opacity-0 translate-y-4"
            : "opacity-100 translate-y-0"
        }`}
      >
        Up & Down App
      </h1>

      {/* Tagline */}
      <p
        className={`relative mt-2 font-dm text-sm text-[hsl(var(--ud-muted))] tracking-widest uppercase transition-all duration-700 delay-500 ${
          phase === "enter"
            ? "opacity-0"
            : "opacity-100"
        }`}
      >
        Power by God
      </p>

      {/* Loading dots */}
      <div className="relative mt-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-[hsl(var(--gold))]"
            style={{
              animation: "pulse-dot 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

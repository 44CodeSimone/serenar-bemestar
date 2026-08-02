import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "serenar_lgpd_v1";

export function LgpdBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-border bg-background/95 p-5 shadow-elegant backdrop-blur md:inset-x-auto md:right-8 md:bottom-8 md:max-w-md">
      <p className="font-serif text-lg text-sage-deep">Sua tranquilidade importa</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Usamos cookies e coletamos apenas o essencial para melhorar sua experiência, conforme a
        LGPD. Ao continuar, você concorda com nossa{" "}
        <Link to="/politica-privacidade" className="underline decoration-gold underline-offset-4">
          política de privacidade
        </Link>
        .
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={accept} className="btn-serena">
          Concordo
        </button>
      </div>
    </div>
  );
}

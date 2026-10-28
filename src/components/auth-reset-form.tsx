"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function AuthResetForm() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (active && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) setReady(true);
    });
    void supabase.auth.getSession().then(({ data: sessionData }: { data: { session: Session | null } }) => {
      if (active && sessionData.session) setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const submit = async (formData: FormData) => {
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password.length < 8) {
      setMessage("La password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Le password non coincidono.");
      return;
    }
    if (!supabase || !ready) {
      setMessage("Apri il link di recupero ricevuto via email su questo dispositivo.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSuccess(true);
    setMessage("Password aggiornata. Ora puoi accedere con la nuova password.");
  };

  return (
    <main className="reset-page">
      <section className="reset-card">
        <span className="reset-mark"><Icon name="leaf" size={22} /></span>
        <span className="eyebrow">FOODCIRCLE · ACCOUNT</span>
        <h1>Imposta una nuova password</h1>
        <p>Il link di recupero è valido secondo le impostazioni del tuo progetto Supabase.</p>
        {!ready && <div className="reset-notice"><Icon name="lock" size={16} /> Verifica il link di recupero nell’email e riapri questa pagina.</div>}
        <form action={submit} className="form-stack reset-form">
          <label className="field-label">Nuova password<input type="password" name="password" minLength={8} autoComplete="new-password" required /></label>
          <label className="field-label">Ripeti la password<input type="password" name="confirmation" minLength={8} autoComplete="new-password" required /></label>
          {message && <p className={success ? "form-success" : "form-error"}>{message}</p>}
          <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? "Aggiornamento..." : "Aggiorna password"}</button>
        </form>
        <Link className="reset-back-link" href="/">Torna a FoodCircle</Link>
      </section>
    </main>
  );
}

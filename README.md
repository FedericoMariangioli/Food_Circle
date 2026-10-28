# FoodCircle

FoodCircle è una prima applicazione web in italiano per tenere un diario alimentare personale e condividere post con una community. Il diario è privato per impostazione predefinita; i post sono indipendenti dai pasti registrati.

## Stato della prima versione

- Interfaccia responsive con Home, Esplora, Diario, Ricette, Community e Profilo.
- Demo locale con pasti, post e preferenze privacy salvati nel browser. I contenuti demo sono esempi e non sono dati nutrizionali attendibili.
- Con Supabase configurato: registrazione, accesso, recupero password, diario persistente, post di testo, commenti, mi piace e impostazioni privacy granulari, con policy Row Level Security.
- Export JSON dei dati personali. Cancellazione dell’account tramite route server, quando è configurata la chiave service role.
- Le ricette e i gruppi visibili nell’interfaccia sono ancora esempi locali. Immagini e post d’esempio usano URL Unsplash.

La demo locale non è un account e non protegge informazioni sanitarie: non inserirvi dati reali. La persistenza e la protezione tra utenti richiedono un progetto Supabase configurato e la migrazione SQL applicata.

## Requisiti

- Node.js 22.12+ (Next.js richiede almeno 20.9; l’ambiente usato per lo sviluppo è Node 22.19).
- npm 11 o compatibile.
- PostgreSQL gestito da Supabase per account e dati persistenti.

Versioni iniziali verificate: Next.js 16.4.3, React 19.3.0, TypeScript 5.x, Tailwind CSS 4.x, Supabase JS 2.x, Zod 4.x, Vitest 5.x e Playwright 1.x. Next.js 16 richiede Node 20.9 o superiore e usa `proxy.ts` al posto di `middleware.ts`.

## Avvio locale

```powershell
cd C:\Users\Federico\Desktop\prova_codex\FoodCircle
npm install
npm run dev
```

Apri <http://localhost:3000>. Senza credenziali l’app parte in **demo locale**.

## Supabase

1. Crea un progetto Supabase e abilita email/password in Authentication.
2. Copia `.env.example` in `.env.local` e imposta `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` dal pannello API del progetto.
3. Incolla ed esegui [`supabase/migrations/001_foodcircle.sql`](supabase/migrations/001_foodcircle.sql) nel SQL Editor del progetto.
4. In Authentication → URL Configuration aggiungi `http://localhost:3000` e `http://localhost:3000/auth/reset` alle URL consentite per i redirect.
5. Riavvia il server di sviluppo.

La chiave `NEXT_PUBLIC_SUPABASE_ANON_KEY` è pubblica e le policy RLS sono il controllo di accesso. La chiave service role, se usata per la cancellazione account, deve restare in `SUPABASE_SERVICE_ROLE_KEY`, solo server e mai condivisa nel client o nel repository.

I valori nutrizionali sono opzionali. Se vengono inseriti, la UI richiede una fonte e la tabella li mantiene separati dal dettaglio del pasto. Valori mancanti sono mostrati come `—`, mai come zero.

## Comandi

```powershell
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

Per i test end-to-end, avvia `npm run dev` in un terminale e, in un secondo terminale nella cartella del progetto, esegui `npm run test:e2e -- --workers=1`.

I test SQL RLS sono in `supabase/tests/rls.sql` e si eseguono con Supabase CLI e Docker disponibili:

```powershell
supabase start
supabase db reset
supabase test db
```

## Documenti

- [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md): fasi e stato verificato.
- [`ARCHITECTURE.md`](ARCHITECTURE.md): confini applicativi, autenticazione e accesso.
- [`DATA_MODEL.md`](DATA_MODEL.md): tabelle, relazioni e privacy.
- [`SECURITY.md`](SECURITY.md): minacce, protezioni e verifiche prima del lancio.
- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md): route account e accesso Supabase.

FoodCircle non offre diagnosi, prescrizioni mediche, classifiche di peso o obiettivi di restrizione calorica.

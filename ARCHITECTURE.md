# Architettura

## Scelte

- **Next.js 16.4.3 App Router** con React 19, TypeScript strict e Tailwind CSS 4.
- **Supabase Auth + PostgreSQL** come backend opzionale per account e dati persistenti.
- **`@supabase/ssr`** per sessioni cookie e rinnovo via `src/proxy.ts`. Il pacchetto è indicato come beta nella documentazione Supabase consultata; va ricontrollato prima di ogni rilascio.
- **Zod 4** per i dati del pasto inseriti dal browser. Le policy PostgreSQL restano il confine di autorizzazione.
- **Vitest 5** per unit test e **Playwright 1** per flussi end-to-end.

## Flusso applicativo

```text
Browser
  ├─ App Router / Client Components
  ├─ Supabase Auth con cookie gestiti da @supabase/ssr
  ├─ Supabase JS → PostgREST con JWT utente
  │     └─ PostgreSQL RLS, policy per riga e funzioni SQL a permessi limitati
  └─ DELETE /api/account → sessione verificata sul server → admin.deleteUser
```

Il client non contiene credenziali privilegiate. Le letture e scritture di pasti, nutrienti, post, commenti, mi piace e privacy usano la chiave anonima insieme al JWT di sessione e sono soggette a RLS. `src/proxy.ts` aggiorna i cookie; non è usato come unico controllo di autorizzazione.

La demo senza variabili Supabase conserva dati dimostrativi in `localStorage`; serve per provare l’interfaccia e non offre autenticazione o protezione tra utenti. I dati demo non vengono caricati nel database.

## Separazione privacy

- `meals` contiene il pasto e la sua visibilità individuale.
- `meal_entries` contiene alimento, quantità e unità.
- `meal_nutrients` contiene i valori e l’etichetta della fonte. La policy della categoria nutrizionale è indipendente dal permesso sul diario.
- `posts` non contiene una relazione a pasti o valori nutrizionali. Condividere un post non rende disponibili diario o dati nutrizionali.
- Il lettore di un pasto condiviso deve superare sia la preferenza globale `diary_visibility` sia la visibilità del singolo pasto.
- I controlli RLS verificano ownership, impostazioni e blocchi nelle richieste al database; i controlli UI sono soltanto ausiliari.

## Integrazioni non configurate

Non sono richiesti servizi esterni per la demo. Supabase richiede un progetto personale; immagini uploadate, catalogo alimentare, email transazionali personalizzate e notifiche push non sono configurati. Le foto d’esempio puntano a Unsplash e non rappresentano contenuti caricati dagli utenti.

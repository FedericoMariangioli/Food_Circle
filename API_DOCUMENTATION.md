# API e accesso ai dati

## Autenticazione

La UI usa Supabase Auth dal browser con cookie SSR:

- Registrazione email/password e username tramite metadata Supabase.
- Accesso email/password.
- Logout.
- Reset: invio link email a `/auth/reset`, quindi aggiornamento della password.

Abilitare email/password e configurare gli URL consentiti dal pannello Supabase. L’eventuale verifica email è regolata dal progetto Supabase.

## Route Next.js

### `DELETE /api/account`

Richiede sessione autenticata, header `Origin` uguale all’origine della richiesta, corpo JSON `{"confirmation":"DELETE MY ACCOUNT"` e `SUPABASE_SERVICE_ROLE_KEY` server-only. Usa `auth.admin.deleteUser` sull’ID della sessione verificata. Risposte: `200` cancellazione completata, `400` conferma errata, `401` sessione assente, `403` origine non valida, `503` configurazione incompleta, `500` errore provider.

Il frontend richiede una conferma esplicita prima della richiesta. Le tabelle con FK verso il profilo sono cancellate a cascata.

## Tabelle Supabase usate dall’app

| Operazione | Tabelle | Controllo |
|---|---|---|
| Leggere il proprio diario | `meals`, `meal_nutrients` | `owner_id = auth.uid()` |
| Registrare un pasto e porzione | `meals`, `meal_entries` | proprietario; `visibility` privata come default |
| Salvare nutrienti | `meal_nutrients` | proprietario, stessa proprietà del pasto, `source_label` obbligatoria |
| Leggere il feed | `posts`, `profiles`, `post_likes`, `comments` | policy `can_view_post` e profilo leggibile |
| Creare post, commento e mi piace | `posts`, `comments`, `post_likes` | autore/utente autenticato e accesso al post |
| Modificare visibilità | `privacy_settings` | aggiorna la sola riga dell’utente autenticato |
| Esportare dati | tabelle personali in `profiles`, diario, social e community | query filtrate per l’ID utente e RLS |

Le chiamate PostgREST sono inviate dal client Supabase con il JWT della sessione e chiave anonima. Non sono route API con chiave privilegiata. Le policy SQL sono la protezione contro IDOR e accesso diretto.

## Test database

[`supabase/tests/rls.sql`](supabase/tests/rls.sql) usa pgTAP per verificare accesso proprietario, negazione tra utenti, indipendenza diario/nutrienti e blocchi. Richiede Supabase CLI con Docker e va eseguito con `supabase test db`.

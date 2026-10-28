# Modello dati

La migrazione iniziale è [`supabase/migrations/001_foodcircle.sql`](supabase/migrations/001_foodcircle.sql). Le chiavi utente derivano da `auth.users`; l’eliminazione dell’account attiva le cancellazioni a cascata delle righe collegate.

| Area | Tabelle | Relazioni e accesso |
|---|---|---|
| Identità | `profiles`, `privacy_settings` | Una riga per utente; ogni preferenza privacy ha una colonna distinta e default privato (tranne attività/ricette secondo la scelta di prodotto). Le impostazioni sono leggibili solo dal proprietario. |
| Connessioni | `follows`, `blocks` | Richieste follow pendenti/accettate; blocchi bidirezionali esclusi dalle query autorizzate. |
| Diario | `meals`, `meal_entries`, `meal_nutrients`, `food_items` | Pasti indipendenti; dettagli porzione separati dai nutrienti. Valori per 100 g opzionali e vincolati a una fonte. Indici su proprietario, data e ricerca alimento. |
| Social | `posts`, `post_media`, `post_likes`, `comments`, `saved_posts` | Post testuali e media separati dal diario. Il lettore deve appartenere all’audience e non essere bloccato. |
| Ricette | `recipes`, `recipe_ingredients`, `saved_recipes` | Proprietario, ingredienti ordinati, unità e porzioni; RLS per proprietario o audience della categoria. |
| Community | `community_groups`, `group_members`, `group_posts` | Gruppi pubblici/privati, ruolo dei membri e contenuti di gruppo. |
| Sicurezza operativa | `notifications`, `reports`, `admin_roles`, `moderation_actions` | Notifiche senza payload nutrizionale, segnalazioni e registro amministrativo. Moderazione non dà accesso ai pasti privati. |

## Regole di integrità

- Foreign key con cancellazione a cascata per i dati posseduti dall’account.
- Username univoco senza distinzione tra maiuscole/minuscole.
- Visibilità ammessa: `private`, `followers`, `public`.
- Valori nutrizionali nullabili e non negativi; se presenti richiedono `source_label`.
- Il trigger verifica che dettagli e nutrienti appartengano allo stesso proprietario del pasto.
- Indici per feed, proprietari, commenti, notifiche e ricerca testuale.

Il peso, gli obiettivi e le metriche di progresso hanno categorie privacy predisposte ma non dispongono ancora di tabelle funzionali. Non vengono raccolti nella prima implementazione.

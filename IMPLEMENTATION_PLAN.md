# Piano di implementazione

| Fase | Stato | Risultato e limite |
|---|---|---|
| 1. Analisi e architettura | Completata | Next.js 16.4.3, React 19, TypeScript, Tailwind 4 e Supabase; architettura documentata. |
| 2. Progetto, design system e navigazione | Completata | App responsive in italiano, navigazione desktop/mobile, componenti e stati interattivi. |
| 3. Database, autenticazione e profili | Implementata, non verificata su un progetto Supabase | Registrazione, accesso, logout, recupero password, schema relazionale e policy RLS. Mancano URL e chiavi del progetto per provare i flussi live. Il profilo consente la gestione privacy ma non modifica ancora foto o bio. |
| 4. Diario e valori nutrizionali | Implementata per inserimento/consultazione | Diario persistente quando Supabase è collegato, campi porzione, visibilità per pasto, valori facoltativi e fonte obbligatoria. Modifica, duplicazione, ricerca alimenti e catalogo esterno restano da implementare. |
| 5. Post, feed, commenti e follower | Implementata in parte | Post testuali, feed RLS, commenti e mi piace. Mancano caricamento foto, risposte annidate, flusso follower/blocco/segnalazione nell’interfaccia e paginazione reale. |
| 6. Privacy granulare | Implementata nello schema e nell’interfaccia | Categorie indipendenti, valori privati predefiniti, scelta per singolo pasto e policy server/database. Le policy SQL sono coperte da test pgTAP predisposti, ma non eseguiti senza Supabase CLI e database. |
| 7. Ricette, recensioni e community | Esempi interattivi | Schermate e schema per ricette/gruppi; le ricette e i gruppi visibili sono contenuti di esempio locali. Recensioni, pubblicazione persistente, moderatori e sfide non sono ancora collegate. |
| 8. Progressi, notifiche e moderazione | Schema parziale | Tabelle per notifiche, segnalazioni e ruoli. Non ci sono ancora dashboard di progresso, centro notifiche, pannello moderazione o messaggistica. |
| 9. Test, sicurezza e documentazione | Verificata localmente | 6 test Vitest e 6 test Playwright superati; lint, controllo TypeScript e build superati. I test pgTAP sono predisposti ma non eseguiti, perché non è collegato un progetto Supabase; i flussi UI sono stati verificati in Chrome desktop, non su dispositivi fisici. |

## Da fare per una beta con utenti reali

1. Configurare un progetto Supabase dedicato e applicare la migrazione; eseguire `supabase test db`.
2. Completare i flussi follower, blocco, segnalazione e moderazione; aggiungere test negativi HTTP e RLS tra account reali.
3. Implementare caricamento immagini con bucket privato, URL firmate, verifica MIME/dimensione e policy Storage.
4. Collegare ricette, ingredienti, gruppi e attività al database; rimuovere i contenuti demo dagli account connessi.
5. Aggiungere editing/copia pasti, alimenti e ricette con fonti documentate; mantenere separati diario e riepiloghi condivisibili.
6. Aggiungere esportazione completa e verificare cancellazione account, backup, retention e cancellazione delle copie archiviate.
7. Revisione indipendente di sicurezza e privacy; valutazione DPIA e verifica legale GDPR prima del lancio.

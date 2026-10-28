# Sicurezza, privacy e GDPR

## Controlli presenti

- Tutte le tabelle applicative della migrazione hanno Row Level Security abilitata.
- Policy separate per proprietario, follower approvati, pubblico e account bloccati.
- Pasti e nutrienti stanno in tabelle diverse; post social senza join automatico al diario.
- Sessione Supabase SSR con cookie e verifica utente sul server per la cancellazione account.
- Route di cancellazione con controllo `Origin`, conferma esplicita e chiave service role solo server.
- Input pasto validato con Zod; quantità e valori non negativi; fonte richiesta quando si dichiarano nutrienti.
- Nessun dato nutrizionale è aggiunto a notifiche o metadati pubblici.
- Nessun tracker pubblicitario o condivisione commerciale dei dati configurati.

## Limiti prima dell’uso reale

- La demo `localStorage` non è sicura per dati alimentari, peso o altre informazioni personali. Usare solo dati dimostrativi.
- Il database e i test pgTAP non sono stati eseguiti contro un progetto Supabase; RLS va verificata prima di caricare dati reali.
- I media degli utenti non sono ancora caricabili. Prima dell’upload impostare bucket privato, limiti, scansione, URL firmate e policy per proprietario/audience.
- Mancano rate limiting, verifica antispam, moderazione operativa, backup configurato e test di ripristino.
- La funzione di esportazione copre le tabelle usate nella prima versione; va aggiornata quando si aggiungono nuove entità.
- La cancellazione è disponibile solo se `SUPABASE_SERVICE_ROLE_KEY` è configurata sul server. Verificare la rimozione nei backup secondo la retention scelta.

## Verifiche legali e operative prima del lancio

1. Mappare basi giuridiche, informative, consensi separati e tempi di conservazione con consulenza privacy.
2. Valutare una DPIA: i dati alimentari e le eventuali informazioni su peso possono rivelare informazioni sulla salute.
3. Definire titolare/responsabili, accordi di trattamento, regioni di hosting e trasferimenti internazionali.
4. Stabilire export completo, rettifica, cancellazione, retention nei backup e gestione delle richieste interessati.
5. Effettuare threat modeling, penetration test, revisione delle policy RLS/Storage e verifica della cancellazione.
6. Aggiungere gestione delle segnalazioni, ricorsi e contenuti potenzialmente dannosi prima di una community aperta.

La documentazione non costituisce parere legale e non dichiara la conformità GDPR del prodotto.

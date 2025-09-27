# Manual test plan – Hero CTA & Stat block

## Scenario: dati configurati
1. Avvia l'app (`npm run dev`) e apri una venue con `primaryCta` e `heroStats` popolati.
2. Verifica che il bottone primario mostri l'etichetta configurata, con icona ArrowUpRight e apertura in nuova scheda se l'URL è esterno.
3. Controlla che le statistiche compaiano in griglia animata (fade/slide) e rispettino valori/sottotitoli dal JSON.
4. Ridimensiona la finestra:
   - Mobile (<768px): layout verticale con CTA sopra e statistiche in stack.
   - Desktop (≥1024px): CTA e descrizione affiancate, griglia su più colonne.

## Scenario: dati mancanti
1. Rimuovi `heroStats` e `primaryCta` dal JSON.
2. Ricarica la venue e verifica che compaiano i fallback "Risposte in <2 min" e "+120 clienti soddisfatti".
3. Assicurati che il bottone di fallback reindirizzi a `#contattaci` o al canale di contatto disponibile (telefono/WhatsApp).
4. Controlla che nessun errore venga mostrato in console e che il layout rimanga coerente.

> Nota: confronta visivamente con uno screenshot precedente per garantire assenza di regressioni maggiori.

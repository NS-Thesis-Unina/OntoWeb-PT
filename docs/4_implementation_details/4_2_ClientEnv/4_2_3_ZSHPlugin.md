# ZSHPlugin
---

La sezione **ZSHPlugin** descrive la componente “client-side CLI” di OntoWeb-PT dal punto di vista implementativo: uno **script Zsh** che avvia una sessione di cattura in un **network namespace dedicato**, raccogliendo in modo coerente **PCAP**, **TLS session keys** e **metadati sui comandi** eseguiti dall’operatore.

L’obiettivo è produrre una **session directory** autosufficiente (e riutilizzabile) che può essere caricata nel Tool (es. tramite il *Send PCAP workflow/wizard*) per l’ingest offline e la ricostruzione dell’evidenza HTTP.

---

## Interfaccia di utilizzo

Lo script espone due entrypoint principali:

- `capture_activate /path/to/logdir myenv`  
  Avvia una sessione di cattura creando directory, namespace, TCP capture e shell interattiva “captured”.
- `capture_deactivate`  
  Termina la sessione di cattura ripristinando il prompt ed uscendo dalla shell di capture.

La sessione è guidata da due parametri:
- `base_dir`: root directory dove creare la session directory (default: `/tmp/log-collector`)
- `virtual_env_prompt`: nome logico della capture session (default: `capture`), usato come:
  - nome del network namespace
  - label nel prompt
  - prefisso directory (assieme al timestamp)

---

## Session directory e artefatti prodotti

Ad ogni attivazione viene generata una cartella con timestamp:

- `session_timestamp = date +"%Y%m%d_%H%M%S"`
- `log_dir = <base_dir>/<virtual_env_prompt>_<session_timestamp>/`

Struttura attesa (semplificata):

- `traffic.pcap`  
  PCAP generato da `tcpdump` sull’interfaccia veth del lato host.
- `sslkeys.log`  
  File TLS keys popolato tramite `SSLKEYLOGFILE` (quando i processi lanciati lo supportano).
- `commands.ndjson`  
  Log NDJSON di comandi eseguiti, con indice, timestamps, exit status e riferimento al PCAP.
- `session.log`  
  Trascrizione “tty-like” dell’intera sessione, prodotta tramite `script(1)`.
- `ZDOTDIR/`  
  Snapshot dei file di configurazione Zsh e copia dello script (per riproducibilità/provenienza).

---

## Flusso di attivazione: `capture_activate`

La funzione `capture_activate()` realizza un workflow end-to-end, organizzabile in cinque step.

### 1) Preparazione directory e snapshot configurazione Zsh

- Crea `log_dir` e la sottocartella `log_dir/ZDOTDIR`.
- Copia file di configurazione Zsh dall’utente:
  - `${ZDOTDIR:-~}/.zsh*(.N)`
  - `${ZDOTDIR:-~}/.zlog*(.N)`
  - `${ZDOTDIR:-~}/.zprofile(.N)`
- Scopo: preservare **provenienza** e consentire una sessione di capture con ambiente controllato.

### 2) Setup network namespace e connettività (veth + NAT)

Crea un namespace dedicato (nome = `virtual_env_prompt`) e un collegamento veth:

- `ip netns add <ns>`
- `ip link add veth-<ns> type veth peer name veth-ns-<ns>`
- Sposta l’endpoint `veth-ns-<ns>` nel namespace
- Configura indirizzi statici:
  - host side: `10.0.0.1/24` su `veth-<ns>`
  - ns side: `10.0.0.2/24` su `veth-ns-<ns>`
- Abilita `lo`, porta su le interfacce e imposta default route nel namespace:
  - `ip route add default via 10.0.0.1`

Per consentire egress verso rete esterna, applica regole iptables:
- `nat POSTROUTING MASQUERADE` per `10.0.0.0/24`
- `FORWARD ACCEPT` in ingresso/uscita su `veth-<ns>`

DNS nel namespace:
- crea `/etc/netns/<ns>/resolv.conf`
- imposta nameserver (8.8.8.8 + 1.1.1.1)

> Nota implementativa: la rete è hard-coded su `10.0.0.0/24` e lo script contiene un TODO relativo ai conflitti (capture concorrenti).

### 3) Bootstrap della shell “captured” tramite `ZDOTDIR`

Lo script copia sé stesso dentro `log_dir/ZDOTDIR/` e modifica la `.zshrc` della sessione:

- `source <...>/capture-prompt.zsh && capture_config <log_dir> <virtual_env_prompt>`

In questo modo la shell interattiva nel namespace:
- applica un prompt “marcato”
- abilita gli hook `preexec/precmd`
- esporta variabili necessarie alla sessione

### 4) Avvio cattura PCAP (tcpdump)

- avvia `tcpdump` in background su `veth-<ns>` con flush immediato:
  - `tcpdump -U -i veth-<ns> -w traffic.pcap &`
- salva il PID per teardown (`TCPDUMP_PID`)

### 5) Avvio sessione interattiva registrata (script + ip netns exec)

L’operatore entra in una shell interattiva *dentro* il namespace, ma con I/O registrato:

- `script -q -f session.log -c "sudo ip netns exec <ns> sudo -u <user> env ZDOTDIR=<...> zsh -i"`

`script(1)` consente di ottenere una trascrizione fedele di ciò che viene visualizzato (utile quando successivamente si vuole correlare output e comandi).

---

## Teardown e cleanup: fine sessione

All’uscita dalla shell interattiva, `capture_activate` procede con cleanup:

- `kill TCPDUMP_PID` per fermare tcpdump
- `ip netns delete <ns>`
- rimuove regole iptables applicate (con `nsenter -t 1 -n iptables ... -D ...`)

In parallelo, dentro la shell di capture è attivo:
- `trap capture_deactivate EXIT`  
  che assicura il ripristino del prompt e l’uscita pulita.

> Nota operativa: come ogni workflow che modifica iptables/namespace con `sudo`, un’interruzione anomala può lasciare residui (regole e/o interfacce). La pulizia è progettata per essere deterministica quando la sessione termina correttamente.

---

## Prompt e stato: `capture_config`

`capture_config(log_dir, virtual_env_prompt)` inizializza lo stato della capture session:

- `LOG_DIRECTORY=<log_dir>` (export)
- `VIRTUAL_ENV_PROMPT=<name>` (export)
- inizializza un contatore globale:
  - `typeset -gi CAPTURE_CMD_INDEX=1`
- abilita `PROMPT_SUBST` e modifica `PS1` in forma:

`[<index>] (<virtual_env_prompt>) <old PS1>`

Gestisce inoltre una modalità di bypass:
- se `CAPTURE_DISABLED` è impostata, non modifica prompt e non attiva la cattura.

---

## Intercettazione comandi: hook `preexec`

Durante la sessione captured, l’hook `preexec()` è la componente chiave per generare metadata e garantire la correlazione “comando ↔ output ↔ PCAP”.

### Regole principali

- Se `CAPTURE_ACTIVE != 1` non fa nulla.
- Esclude esplicitamente i comandi:
  - `capture_activate`
  - `capture_deactivate`

### TLS key logging per comando

Ad ogni comando, prima dell’esecuzione:
- `export SSLKEYLOGFILE="$LOG_DIRECTORY/sslkeys.log"`

Questo permette ai processi avviati da quel comando di loggare (quando supportato) le chiavi TLS, abilitando decryption/analisi del PCAP in pipeline offline.

### Esecuzione controllata del comando

Lo script:
- registra `ts_start`
- esegue il comando con:
  - `eval "$1" </dev/tty >/dev/tty 2>&1`
- cattura `CMD_STATUS=$?`
- registra `ts_end`

Il redirect su `/dev/tty` mira a preservare comportamento interattivo e a garantire che l’output sia catturato dalla registrazione `script(1)`.

### Logging NDJSON: `commands.ndjson`

Dopo l’esecuzione, viene appendata una riga JSON (NDJSON) con:
- `index` (progressivo)
- `timestamp start` / `timestamp end`
- `command` (escaped tramite `jq -Rn`)
- `pcap_file` (path del PCAP)
- `status` (exit code)

Infine:
- `(( CAPTURE_CMD_INDEX++ ))`
- `kill -INT $$`

Quest’ultimo passaggio è un meccanismo di controllo che evita la doppia esecuzione del comando da parte del normale flusso della shell, dato che il comando è già stato eseguito manualmente dentro `preexec`.

---

## Comportamenti di guard-rail

### Override di `clear()`

La funzione `clear` viene ridefinita:

- se `CAPTURE_ACTIVE == 1`, impedisce `clear` con messaggio:
  - `"Command 'clear' is not allowed while capture is active."`

Motivazione: preservare leggibilità e coerenza della registrazione `session.log` (evitando “pulizie” che rendono meno utile la trascrizione).

### `precmd()` (stub)

`precmd()` contiene un placeholder per future estrazioni dell’output per-comando:

- ipotizza `capture_<index>.log` come output file per singolo comando
- nota TODO: “awk command to extract output”

Ad oggi, l’output completo è comunque disponibile in `session.log`, mentre la correlazione per comando è affidata a `commands.ndjson` (indice + timestamps).

---

## Dipendenze e requisiti runtime

Il funzionamento presuppone un ambiente Linux con:
- `zsh` e supporto hook `preexec/precmd`
- `iproute2` (`ip netns`, `ip link`, `ip addr`, `ip route`)
- `iptables`
- `tcpdump`
- `util-linux` (`script`, `nsenter`)
- `jq` (per escaping JSON del comando)
- privilegi `sudo` per namespace/iptables/tcpdump

---

## Collegamento con OntoWeb-PT

Gli artefatti prodotti dal plugin sono progettati per alimentare i workflow di ingest offline:

- `traffic.pcap` + `sslkeys.log` → ricostruzione HTTP/HTTPS da PCAP
- `commands.ndjson` → metadata e tracciabilità operatore (sequenza, exit status, finestre temporali)
- `ZDOTDIR/` + naming directory → riproducibilità e provenance

In questo senso, lo ZSHPlugin agisce come “acquisition helper” per costruire dataset **controllati** e **comparabili** rispetto alle acquisizioni live (es. Browser Extension), mantenendo un formato coerente con le assunzioni della pipeline di ingest.

---

# OntoWeb-PT ZSH Plugin

Questa cartella contiene lo **ZSH Plugin** di OntoWeb-PT, un componente client-side che consente di avviare una **sessione di cattura controllata** per raccogliere evidenza di traffico di rete e metadati operativi, in formato compatibile con i workflow di ingest del tool (es. caricamento PCAP tramite Dashboard).

Lo script principale è:
- `capture-prompt.zsh`

Il plugin è pensato per produrre una **session directory** autosufficiente contenente:
- **PCAP** (`traffic.pcap`)
- **TLS keys log** (`sslkeys.log`, quando supportato dai processi)
- **command log** (`commands.ndjson`)
- **session transcript** (`session.log`)
- snapshot di configurazione Zsh (`ZDOTDIR/`)

---

## Contenuto della cartella

zsh-plugin/
├── capture-prompt.zsh
├── c/ # Work in progress: porting dello ZSH plugin in C
│
└── README.md

La sottocartella `c/` contiene un lavoro sperimentale non ancora completato, avviato per valutare una versione più “standalone” del plugin tramite implementazione in C.

---

## Funzionalità principali

Il plugin implementa un workflow di cattura basato su:

- **network namespace dedicato**
  - isolamento del traffico generato nella sessione
  - interfaccia `veth` e configurazione routing/NAT
- **PCAP capture**
  - cattura `tcpdump` sull’interfaccia veth lato host
- **TLS key logging**
  - esportazione `SSLKEYLOGFILE` per supportare decryption offline (quando disponibile)
- **command tracking**
  - hook Zsh per intercettare comandi, timestamp ed exit status
  - log strutturato NDJSON per correlazioni successive

---

## Requisiti

Il plugin richiede un ambiente Linux con:
- `zsh`
- `iproute2` (per `ip netns`, `ip link`, `ip addr`, `ip route`)
- `iptables`
- `tcpdump`
- `util-linux` (per `script`, `nsenter`)
- `jq`
- privilegi `sudo` (namespace/iptables/tcpdump)

---

## Uso

### Attivazione

```bash
source ./capture-prompt.zsh
capture_activate /path/to/logdir myenv
```
- `base_dir` (default: `/tmp/log-collector`)
- `virtual_env_prompt` (default: `capture`)

All’avvio, il plugin crea una session directory con timestamp, prepara il namespace, avvia `tcpdump` e apre una shell interattiva “captured” dentro il namespace.

### Disattivazione

All’interno della shell di capture:

`capture_deactivate`

La sessione termina ripristinando il prompt e rilasciando le risorse (namespace, regole iptables, tcpdump).

---

## Output: session directory

Esempio (semplificato):

```
<base_dir>/<env>_<timestamp>/
├── traffic.pcap
├── sslkeys.log
├── commands.ndjson
├── session.log
└── ZDOTDIR/
    ├── .zshrc
    ├── .zprofile
    ├── ...
    └── capture-prompt.zsh
```

Questi artefatti possono essere utilizzati per:
- analisi offline del traffico
- ricostruzione evidenza HTTP/HTTPS da PCAP
- correlazione tra comandi operatore e finestre temporali del traffico

---

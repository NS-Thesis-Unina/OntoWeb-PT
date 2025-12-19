# Script Python `pcap_to_http_json.py`
---

Questo documento descrive lo script Python `pcap_to_http_json.py`, utilizzato dalla rotta `routes/pcap.js` per convertire una cattura **PCAP/PCAPNG** (eventualmente con decrittazione TLS tramite keylog) in un JSON compatibile con l’endpoint dell’API Server:

- `POST /http-requests/ingest-http`

Lo script stampa su **stdout** un **array JSON** di richieste HTTP, mentre stampa su **stderr** messaggi diagnostici (`[DEBUG]`, `[ERROR]`).

---

## 1) Scopo e output

### Scopo
- Estrarre da un file PCAP il traffico **HTTP/1.x** e **HTTP/2**.
- Se presente un file **TLS key log**, chiedere a `tshark` di decifrare HTTPS e rendere visibili i layer HTTP/2 e HTTP/1.1.
- Ricostruire per ogni richiesta un oggetto conforme allo schema atteso dall’API `ingest-http`, includendo **opzionalmente** la response (status, header e body).

### Output (schema logico)
Lo script produce una lista di oggetti del tipo:

```json
[
  {
    "id": "pcap-http1-<ts>-<frame>",
    "method": "GET",
    "httpVersion": "HTTP/1.1",
    "uri": {
      "full": "https://example.com/path?a=1",
      "scheme": "https",
      "authority": "example.com",
      "path": "/path",
      "queryRaw": "a=1",
      "params": [{ "name": "a", "value": "1" }]
    },
    "requestHeaders": [{ "name": "host", "value": "example.com" }],
    "connection": { "authority": "1.2.3.4:443" },
    "response": {
      "statusCode": 200,
      "httpVersion": "HTTP/1.1",
      "reasonPhrase": "OK",
      "responseHeaders": [{ "name": "content-type", "value": "text/html" }],
      "body": "<base64>"
    }
  }
]
```

Nota: la presenza del blocco response dipende dal fatto che lo script riesca a collegare richiesta e risposta; se non trova la response, l’oggetto contiene solo la request.
## 2) Interfaccia CLI

### Esecuzione

Lo script è un eseguibile CLI:
`python pcap_to_http_json.py <pcap_path> <sslkeys_path>`
- `<pcap_path>`: percorso del file `.pcap` / `.pcapng`
- `<sslkeys_path>`: percorso del file TLS keylog (es. `sslkeys.log`)

### Exit codes

- `0`: successo
- `1`: argomenti mancanti (usage)
- `2`: errore nell’esecuzione di `tshark` o nella decodifica JSON

---

## 3) Dipendenze e configurazione

### Dipendenze di sistema
- `tshark` deve essere installato e accessibile nel PATH, oppure configurato tramite env var.

### Variabili d’ambiente
- `TSHARK_BIN` (opzionale): path/nome del binario `tshark` (default: `tshark`)

---

## 4) Pipeline: da PCAP a JSON

La pipeline è composta da tre macro-step:
1. **Esecuzione `tshark`** sul PCAP con export JSON e campi mirati (HTTP/1.x e HTTP/2).
2. **Costruzione delle richieste**: interpretazione dei pacchetti come request HTTP/1.x o HTTP/2.    
3. **Join response → request**: collegamento della response corrispondente e arricchimento dell’oggetto request.    

---

## 5) Esecuzione di `tshark` (`run_tshark`)

### Obiettivo

- Leggere il PCAP (`-r`)
- Impostare il keylog TLS (`-o tls.keylog_file:<sslkeys_path>`)
- Filtrare pacchetti con `http || http2` (`-Y`)
- Esportare un JSON (`-T json`) con una lista di campi (`-e ...`) necessari a ricostruire request/response.

### Campi rilevanti richiesti a tshark

Lo script esporta, tra gli altri:
- Metadati frame/connessione:
    - `frame.number`, `ip.src`, `ip.dst`, `tcp.srcport`, `tcp.dstport`, `tcp.stream`
- HTTP/1.x request:
    - `http.request.full_uri`, `http.request.method`, `http.request.version`
    - `http.host`, `http.request.uri`, `http.user_agent`, `http.cookie`, `http.referer`
- HTTP/1.x response:
    - `http.response.code`, `http.response.phrase`, `http.response.version`
    - `http.server`, `http.content_type`, `http.set_cookie`, `http.location`, `http.content_length_header`
    - `http.request_in` (link response → request)
    - `http.file_data` (body quando disponibile)
- HTTP/2:
    - `http2.streamid`
    - request pseudo-headers: `http2.headers.method`, `http2.headers.scheme`, `http2.headers.authority`, `http2.headers.path`
    - response headers: `http2.headers.status`, `http2.headers.server`, `http2.headers.content_type`,  
        `http2.headers.set_cookie`, `http2.headers.location`, `http2.headers.content_length`
    - body: `http2.body.reassembled.data` (quando disponibile)

---

## 6) Costruzione delle richieste (`http_request_from_layers`)

### Riconoscimento request HTTP/1.x

Una request HTTP/1.x viene riconosciuta se è presente:
- `http.request.method`

Campi estratti:
- `method`: da `http.request.method`
- `httpVersion`: da `http.request.version` (fallback `"HTTP/1.1"`)
- `uri`: costruita usando:
    - `http.request.full_uri` (se presente)
    - fallback su `http.host` + `http.request.uri`
- `requestHeaders`: popolati da alcuni header “comuni” se disponibili (host, user-agent, cookie, referer)
- `connection.authority`: calcolata da `ip.dst:tcp.dstport`

Chiave di join per la risposta:
- `("http1", frame.number)`

### Riconoscimento request HTTP/2

Una request HTTP/2 viene riconosciuta se è presente:
- `http2.headers.method`

Campi estratti:
- `method`: da `http2.headers.method`
- `httpVersion`: `"HTTP/2"`
- `uri`: costruita combinando pseudo-headers:
    - se `scheme + authority + path`: `scheme://authority + path`
    - altrimenti fallback assumendo `https://authority + path`
- `requestHeaders`: pseudo-headers esposti come header con nomi `:authority`, `:scheme`, `:path`
- `connection.authority`: da `ip.dst:tcp.dstport`

Chiave di join per la risposta:
- `("http2", tcp.stream, streamid)`

### Generazione ID

Ogni request riceve un id “stabile per run”:
- HTTP/1.x:
    - `pcap-http1-<RUN_TIMESTAMP_MS>-<frame_no>`
- HTTP/2:
    - `pcap-http2-<RUN_TIMESTAMP_MS>-<frame_no>-s<streamid>`

Dove `RUN_TIMESTAMP_MS` è un timestamp inizializzato una sola volta (all’avvio script).

---

## 7) Join e arricchimento delle response

La funzione `extract_http_from_packets()` scorre tutti i pacchetti esportati da tshark:

### 7.1 Join response HTTP/1.x

- Riconosce una response se esiste `http.response.code`.
- Per collegarla alla request usa `http.request_in`, che indica il frame.number della request originale.
- Chiave: `("http1", http.request_in)`.

Arricchisce `req["response"]` con:
- `statusCode` (int)
- `httpVersion` (fallback `"HTTP/1.1"`)
- `reasonPhrase` (se presente)
- `responseHeaders` (server, content-type, location, content-length, set-cookie)
- `body` in base64, se presente in `http.file_data`

### 7.2 Join response HTTP/2

- Riconosce una response se esiste `http2.headers.status`.
- Join su:
    - `tcp.stream`
    - `http2.streamid`
- Chiave: `("http2", tcp.stream, streamid)`.

Arricchisce `req["response"]` con:
- `statusCode` (int)
- `httpVersion`: `"HTTP/2"`
- `responseHeaders` (server, content-type, location, content-length, set-cookie)
- `body` in base64 da `http2.body.reassembled.data` (se presente)

---

## 8) Gestione body: conversione a base64

I body HTTP, quando disponibili, arrivano da tshark come “byte sequence” espressa in esadecimale (spazi o `:`).  
La funzione `byte_sequence_field_to_base64()`:
- normalizza la stringa di hex
- converte in bytes (`bytes.fromhex`)
- codifica in base64 (stringa ASCII)

Questo rende il body compatibile con trasporto JSON e con lo schema di ingest lato API.

---

## 9) Considerazioni operative e limiti

- Lo script si basa su ciò che tshark riesce a esportare:
    - non tutte le catture contengono body ricostruibili;
    - su HTTP/2 il campo `http2.body.reassembled.data` può dipendere dalla build/feature set di tshark.
- La correlazione request/response:
    - HTTP/1.x: dipende da `http.request_in`
    - HTTP/2: dipende da `tcp.stream` e `streamid`
- L’output è pensato per ingestion “best-effort”: è normale ottenere request senza response.

---

## 10) Integrazione con `routes/pcap.js` (overview)

La rotta `pcap.js`:
- riceve file `pcap` e `sslkeys`
- invoca questo script tramite processo esterno
- legge `stdout` come JSON
- inoltra gli oggetti ottenuti al flusso `/http-requests/ingest-http`

Il logging dettagliato di upload/esecuzione/cleanup è gestito lato Node, mentre lo script Python emette diagnostica su `stderr`.

---
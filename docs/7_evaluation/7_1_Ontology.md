# Ontology Evaluation
---

- [Evaluation Datasets](./7_1_Ontology/7_1_1_Evaluation_Datasets.md)
- [Ontology Conformance Check](./7_1_Ontology/7_1_2_Evaluation_Ontology_Conformance_Check.md)
- [Named Graph Integrity](./7_1_Ontology/7_1_3_Evaluation_Named_Graph_Integrity.md)
- [SHACL Constraint Validation](./7_1_Ontology/7_1_4_SHACL_Constraint_Validation.md)
- [CQ-Based Evaluation (Competency Questions)](./7_1_Ontology/7_1_5_CQ_Based_Evaluation.md)
- [OOPS!-Based Evaluation](./7_1_Ontology/7_1_6_OOPS_Evaluation.md)
- [Ontologies Comparison and Integration](./7_1_Ontology/7_1_7_Ontologies_Comparison_Integration.md)
- [Related Works Evaluation](./7_1_Ontology/7_1_8_Related_Works_Evaluation.md)

---

Questa sezione raccoglie le verifiche orientate alla **qualità ontologica** e alla **correttezza dell’ingest** dal punto di vista del modello semantico.  
L’obiettivo non è misurare performance o usability, ma garantire che i dati persistiti in GraphDB:

- rispettino le **obbligazioni strutturali** imposte dal modello (entità e relazioni richieste);
- mantengano una **tracciabilità deterministica** tramite **named graphs** (separazione tra evidenza grezza e risultati derivati);
- risultino **interrogabili via SPARQL** per rispondere alle domande previste dai casi d’uso (competency questions);
- soddisfino controlli di qualità *TBox hygiene* tramite strumenti esterni (OOPS!).

## Dataset e comparabilità
La valutazione usa dataset “a coppie” sullo stesso target per confrontare acquisizioni equivalenti:
- **DSE\***: acquisizioni via **Extension** (live interception)
- **DSP\***: acquisizioni via **PCAP** (offline reconstruction)

I dettagli (target, timestamp, cardinalità richieste e triple generate) sono riportati in **Evaluation Datasets**.

## Tipologie di validazione incluse
Le attività sono organizzate in documenti separati, ciascuno focalizzato su un criterio:

- **Conformance check (SPARQL)**: conteggi e controlli di obbligatorietà per identificare missing links o entità non materializzate.
- **Named graph integrity (SPARQL)**: verifica della disciplina di persistenza per grafi nominati e delle cross-graph references.
- **SHACL validation**: formalizzazione di vincoli ad alto impatto in shapes eseguibili direttamente in GraphDB.
- **Competency Questions**: validazione “use-case driven” della queryability (CQs + query SPARQL + risultati).
- **OOPS!**: quality scan per pitfall ontologici e miglioramenti incrementali tra versioni.
- **Comparazione ontologie HTTP** e **valutazione rispetto ai related works**: allineamenti concettuali e coverage rispetto a modelli noti.

## Assets e report
Gli artefatti di supporto (CSV, output CQ, report OOPS) sono salvati in:
`7_evaluation/7_1_Ontology/assets/`
e vengono referenziati direttamente dai documenti della sezione.

---
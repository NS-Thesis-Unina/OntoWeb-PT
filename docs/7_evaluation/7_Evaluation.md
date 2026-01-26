# Evaluation
---

- [Ontology](./7_1_Ontology.md)

---

Questa sezione documenta le attività di **valutazione** svolte su OntoWeb-PT con focus su ciò che rende la knowledge base *affidabile per l’investigazione*:  
1) **correttezza della persistenza semantica** (ingestion → GraphDB) e  
2) **queryability SPARQL** coerente con i casi d’uso e con gli obiettivi di analisi.

L’approccio adottato è **dataset-scoped** e si basa su **paired acquisitions** sullo stesso target, confrontando:
- **live interception** (Browser Extension) e
- **offline reconstruction** (PCAP + TLS keys),

così da poter verificare che il knowledge base risultante resti **comparabile** e **consistente** a parità di evidenza osservata.

Al momento, la valutazione è organizzata nella sottosezione **Ontology**, che raccoglie i controlli e i report utilizzati per validare la parte ontologica (TBox/ABox) e la disciplina dei grafi nominati.

---
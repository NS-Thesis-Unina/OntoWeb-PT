#!/usr/bin/env python3
"""
Evaluate Competency Questions (CQs) against multiple GraphDB repositories.

Input: a semicolon-separated CSV with at least these columns:
- cq_id
- use_case
- scenario_step
- dimension
- question
- sparql
- required_features
- pass_rule

The SPARQL query is expected to be a SELECT that returns 0 rows if the CQ passes,
and returns one row per missing required feature (variable name: ?feature) if it fails.
This matches the generated file: competency_questions_with_sparql_rules.csv

Output: same CSV + 3 columns:
- w3c_result
- http_onto_result
- ontowebpt_result

Each result cell is:
- PASS
- FAIL (missing: ... )
- FAIL (error: ... )
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import Dict, List, Optional, Tuple

import pandas as pd

try:
    import requests  # type: ignore
except ImportError:
    requests = None  # pragma: no cover


def sparql_endpoint(base_url: str, repo_id: str) -> str:
    base_url = base_url.rstrip("/")
    return f"{base_url}/repositories/{repo_id}"


def post_sparql_select(
    endpoint: str,
    query: str,
    timeout_s: int = 30,
    auth: Optional[Tuple[str, str]] = None,
) -> dict:
    if requests is None:
        raise RuntimeError("Missing dependency: requests. Install it with `pip install requests`.")

    headers = {
        "Accept": "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    }
    resp = requests.post(
        endpoint,
        data={"query": query},
        headers=headers,
        timeout=timeout_s,
        auth=auth,
    )
    resp.raise_for_status()
    return resp.json()


def extract_missing_features(result_json: dict) -> List[str]:
    # ASK response
    if "boolean" in result_json:
        return [] if bool(result_json["boolean"]) else ["ASK returned false"]

    # SELECT response
    bindings = (((result_json.get("results") or {}).get("bindings")) or [])
    missing: List[str] = []
    for b in bindings:
        if "feature" in b:
            missing.append(b["feature"]["value"])
        else:
            # fallback: take the first variable in this binding
            if b:
                first_key = next(iter(b.keys()))
                missing.append(b[first_key]["value"])
            else:
                missing.append("unknown")
    # unique, preserve order
    seen = set()
    out = []
    for x in missing:
        if x not in seen:
            out.append(x)
            seen.add(x)
    return out


def evaluate_query(
    endpoint: str,
    query: str,
    timeout_s: int,
    auth: Optional[Tuple[str, str]],
) -> str:
    try:
        res = post_sparql_select(endpoint, query, timeout_s=timeout_s, auth=auth)
        missing = extract_missing_features(res)

        # Convention: empty => PASS; otherwise FAIL + missing list
        if len(missing) == 0:
            return "PASS"
        return "FAIL (missing: " + ", ".join(missing) + ")"
    except Exception as e:
        msg = str(e).replace("\n", " ").strip()
        if len(msg) > 250:
            msg = msg[:247] + "..."
        return f"FAIL (error: {msg})"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--input",
        required=True,
        help="Input CSV (semicolon-separated), e.g. competency_questions_with_sparql_rules.csv",
    )
    ap.add_argument(
        "--output",
        default="competency_questions_results.csv",
        help="Output CSV (semicolon-separated).",
    )
    ap.add_argument(
        "--graphdb",
        default="http://localhost:7200",
        help="GraphDB base URL (default: http://localhost:7200).",
    )
    ap.add_argument(
        "--repo-w3c",
        default="w3c",
        help="Repository id for W3C ontology (default: w3c).",
    )
    ap.add_argument(
        "--repo-http-onto",
        default="http-onto",
        help="Repository id for http-onto ontology (default: http-onto).",
    )
    ap.add_argument(
        "--repo-ontowebpt",
        default="ontowebpt",
        help="Repository id for OntoWeb-PT ontology (default: ontowebpt).",
    )
    ap.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="HTTP timeout per SPARQL query in seconds (default: 30).",
    )
    ap.add_argument(
        "--username",
        default=None,
        help="Optional GraphDB username (basic auth).",
    )
    ap.add_argument(
        "--password",
        default=None,
        help="Optional GraphDB password (basic auth).",
    )
    ap.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional limit: evaluate only the first N CQs (useful for quick tests).",
    )
    args = ap.parse_args()

    auth: Optional[Tuple[str, str]] = None
    if args.username is not None or args.password is not None:
        if not args.username or not args.password:
            print("If you pass --username or --password, you must pass both.", file=sys.stderr)
            return 2
        auth = (args.username, args.password)

    df = pd.read_csv(args.input, sep=";", dtype=str).fillna("")
    if args.limit is not None:
        df = df.head(args.limit)

    # Validate required columns
    if "sparql" not in df.columns:
        print("Input CSV is missing the 'sparql' column.", file=sys.stderr)
        return 2

    endpoints = {
        "w3c_result": sparql_endpoint(args.graphdb, args.repo_w3c),
        "http_onto_result": sparql_endpoint(args.graphdb, args.repo_http_onto),
        "ontowebpt_result": sparql_endpoint(args.graphdb, args.repo_ontowebpt),
    }

    total = len(df)
    out_rows = []
    t0 = time.time()
    for i, row in df.iterrows():
        query = row.get("sparql", "")
        if not query.strip():
            # If query is empty, treat as FAIL with reason
            row["w3c_result"] = "FAIL (error: empty SPARQL)"
            row["http_onto_result"] = "FAIL (error: empty SPARQL)"
            row["ontowebpt_result"] = "FAIL (error: empty SPARQL)"
            out_rows.append(row)
            continue

        for col, ep in endpoints.items():
            row[col] = evaluate_query(ep, query, timeout_s=args.timeout, auth=auth)

        out_rows.append(row)

        # lightweight progress
        if (len(out_rows) % 25) == 0 or len(out_rows) == total:
            elapsed = time.time() - t0
            print(f"[{len(out_rows)}/{total}] done in {elapsed:.1f}s", file=sys.stderr)

    out_df = pd.DataFrame(out_rows)
    out_df.to_csv(args.output, sep=";", index=False)

    print(f"Saved results to: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

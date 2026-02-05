#!/usr/bin/env python3
"""
Execute Competency-Question SPARQL queries against GraphDB and write ONLY a final summary CSV,
with real-time logs.

Input CSV columns expected (minimum):
  cq_id; use_case; scenario_step; dimension; question; sparql; sparql_kind; pass_rule; notes

Usage (PowerShell):
  python run_cq_sparql_graphdb_summary.py ^
    --endpoint "http://localhost:7200/repositories/ontowebpt" ^
    --in_csv "competency_questions_interceptor_with_sparql.csv" ^
    --out_csv "cq_results.csv" ^
    --optimize_limit1 ^
    --log_every 25

Optional:
  --workers 4
  --timeout 60
  --max_queries 50
  --verbose
"""
import argparse
import csv
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, Tuple, Any, List

# ---- HTTP client: requests if available, else urllib ----
try:
    import requests  # type: ignore
    _HAS_REQUESTS = True
except Exception:
    _HAS_REQUESTS = False
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError

def log(msg: str):
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def optimize_query_for_passfail(sparql: str, sparql_kind: str, pass_rule: str, enabled: bool) -> str:
    """
    Reduce response size/time for pass/fail style checks by forcing LIMIT 1 when safe.
    Applies to SELECT queries when we only need existence/emptiness:
      - non_empty  -> need >= 1 row
      - empty_ok   -> need 0 rows
    """
    if not enabled:
        return sparql
    kind = (sparql_kind or "SELECT").strip().upper()
    rule = (pass_rule or "").strip().lower()

    if kind != "SELECT":
        return sparql
    if rule not in ("non_empty", "empty_ok"):
        return sparql

    s = sparql.strip()
    m = re.search(r"\bLIMIT\b\s+\d+", s, flags=re.IGNORECASE)
    if m:
        return re.sub(r"\bLIMIT\b\s+\d+", "LIMIT 1", s, flags=re.IGNORECASE)

    return s + "\nLIMIT 1\n"

def _post_sparql_requests(endpoint: str, sparql: str, timeout: int) -> Dict[str, Any]:
    headers = {
        "Accept": "application/sparql-results+json",
        "Content-Type": "application/sparql-query; charset=utf-8",
    }
    r = requests.post(endpoint, data=sparql.encode("utf-8"), headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.json()

def _post_sparql_urllib(endpoint: str, sparql: str, timeout: int) -> Dict[str, Any]:
    data = sparql.encode("utf-8")
    req = Request(endpoint, data=data, method="POST")
    req.add_header("Accept", "application/sparql-results+json")
    req.add_header("Content-Type", "application/sparql-query; charset=utf-8")
    try:
        with urlopen(req, timeout=timeout) as resp:
            payload = resp.read().decode("utf-8", errors="replace")
            return json.loads(payload)
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        raise RuntimeError(f"HTTPError {e.code}: {e.reason}. Body: {body[:500]}")
    except URLError as e:
        raise RuntimeError(f"URLError: {e.reason}")

def post_sparql(endpoint: str, sparql: str, timeout: int) -> Dict[str, Any]:
    if _HAS_REQUESTS:
        return _post_sparql_requests(endpoint, sparql, timeout)
    return _post_sparql_urllib(endpoint, sparql, timeout)

def normalize_result(data: Dict[str, Any], kind: str) -> Dict[str, Any]:
    kind_u = (kind or "SELECT").strip().upper()
    if kind_u == "ASK":
        return {"kind": "ASK", "boolean": bool(data.get("boolean", False))}
    bindings = data.get("results", {}).get("bindings", [])
    return {"kind": "SELECT", "row_count": len(bindings), "bindings": bindings}

def eval_pass(pass_rule: str, normalized: Dict[str, Any]) -> bool:
    rule = (pass_rule or "").strip().lower()

    if rule == "ask=true":
        return normalized.get("kind") == "ASK" and normalized.get("boolean") is True

    if rule == "non_empty":
        return normalized.get("kind") == "SELECT" and normalized.get("row_count", 0) > 0

    if rule == "count>=1":
        if normalized.get("kind") != "SELECT":
            return False
        bindings = normalized.get("bindings", [])
        if not bindings:
            return False
        b0 = bindings[0]
        if "count" not in b0:
            return False
        try:
            return int(b0["count"]["value"]) >= 1
        except Exception:
            return False

    if rule == "empty_ok":
        # Quality checks: PASS if no issues returned
        return normalized.get("kind") == "SELECT" and normalized.get("row_count", 0) == 0

    if rule == "query_ok":
        return True

    return True

def summarize_row(row: Dict[str, str], maxlen: int = 90) -> str:
    q = (row.get("question") or "").strip().replace("\n", " ")
    if len(q) > maxlen:
        q = q[:maxlen - 3] + "..."
    return q

def run_one(row: Dict[str, str], endpoint: str, timeout: int, optimize_limit1: bool) -> Tuple[str, Dict[str, Any]]:
    cq_id = (row.get("cq_id") or "").strip()
    sparql = row.get("sparql") or ""
    sparql_kind = (row.get("sparql_kind") or "SELECT").strip()
    pass_rule = row.get("pass_rule") or "query_ok"

    sparql_exec = optimize_query_for_passfail(sparql, sparql_kind, pass_rule, enabled=optimize_limit1)

    data = post_sparql(endpoint, sparql_exec, timeout=timeout)
    normalized = normalize_result(data, sparql_kind)

    passed = eval_pass(pass_rule, normalized)
    row_count = normalized.get("row_count", "")
    if normalized.get("kind") == "ASK":
        row_count = ""

    return cq_id, {"passed": passed, "error": "", "row_count": row_count}

def eta_str(done: int, total: int, elapsed: float) -> str:
    if done == 0:
        return "ETA: --"
    rate = done / elapsed
    remaining = (total - done) / rate if rate > 0 else 0
    return f"ETA: {int(remaining)}s"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", required=True)
    ap.add_argument("--in_csv", required=True)
    ap.add_argument("--out_csv", default="cq_results.csv")
    ap.add_argument("--timeout", type=int, default=60)
    ap.add_argument("--workers", type=int, default=1, help="Default 1 to avoid overloading GraphDB.")
    ap.add_argument("--optimize_limit1", action="store_true", help="Force LIMIT 1 for non_empty/empty_ok checks.")
    ap.add_argument("--max_queries", type=int, default=0, help="If >0, run only first N queries.")
    ap.add_argument("--log_every", type=int, default=25, help="Print progress every N queries.")
    ap.add_argument("--verbose", action="store_true", help="Print one log line per query.")
    args = ap.parse_args()

    in_path = Path(args.in_csv)
    if not in_path.exists():
        raise FileNotFoundError(f"Input CSV not found: {in_path}")

    rows: List[Dict[str, str]] = []
    with in_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for i, row in enumerate(reader, start=1):
            rows.append({k: (v or "") for k, v in row.items()})
            if args.max_queries and i >= args.max_queries:
                break

    total = len(rows)
    if total == 0:
        log("No rows found in input CSV.")
        sys.exit(0)

    log(f"Starting run: {total} queries | workers={args.workers} | timeout={args.timeout}s | optimize_limit1={args.optimize_limit1}")
    log(f"Endpoint: {args.endpoint}")
    if not _HAS_REQUESTS:
        log("requests not installed: using urllib (stdlib).")

    results_by_id: Dict[str, Dict[str, Any]] = {}
    ok = fail = err = 0
    t0 = time.time()

    def on_result(cq_id: str, row: Dict[str, str], res: Dict[str, Any], dt: float):
        nonlocal ok, fail, err
        passed = bool(res.get("passed", False))
        error = (res.get("error") or "").strip()
        if error:
            err += 1
        elif passed:
            ok += 1
        else:
            fail += 1

        if args.verbose:
            qshort = summarize_row(row)
            rc = res.get("row_count", "")
            rc_part = f" | rows={rc}" if rc != "" else ""
            log(f"{cq_id}: {'PASS' if passed else 'FAIL'}{rc_part} | {dt:.2f}s | {qshort}")
        else:
            done = ok + fail + err
            if args.log_every and (done % args.log_every == 0 or done == total):
                elapsed = time.time() - t0
                log(f"Progress {done}/{total} | PASS={ok} FAIL={fail} ERR={err} | elapsed={int(elapsed)}s | {eta_str(done,total,elapsed)}")

    if args.workers and args.workers > 1:
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            fut_map = {}
            for row in rows:
                cq_id = (row.get("cq_id") or "").strip()
                fut = ex.submit(run_one, row, args.endpoint, args.timeout, args.optimize_limit1)
                fut_map[fut] = row

            for fut in as_completed(fut_map):
                row = fut_map[fut]
                cq_id = (row.get("cq_id") or "").strip()
                t1 = time.time()
                try:
                    cid, res = fut.result()
                    results_by_id[cid] = res
                    dt = time.time() - t1  # note: measures post-completion window, not exact call duration
                    on_result(cid, row, res, dt)
                except Exception as e:
                    res = {"passed": False, "error": str(e), "row_count": ""}
                    results_by_id[cq_id] = res
                    dt = time.time() - t1
                    on_result(cq_id, row, res, dt)
    else:
        for idx, row in enumerate(rows, start=1):
            cq_id = (row.get("cq_id") or "").strip()
            if args.verbose:
                log(f"Running {idx}/{total}: {cq_id} | pass_rule={row.get('pass_rule','')} | kind={row.get('sparql_kind','')}")
            start = time.time()
            try:
                cid, res = run_one(row, args.endpoint, args.timeout, args.optimize_limit1)
                results_by_id[cid] = res
                dt = time.time() - start
                on_result(cid, row, res, dt)
            except Exception as e:
                res = {"passed": False, "error": str(e), "row_count": ""}
                results_by_id[cq_id] = res
                dt = time.time() - start
                on_result(cq_id, row, res, dt)

    # Write final CSV
    out_fields = ["cq_id","use_case","scenario_step","dimension","question","sparql","pass_rule","notes","result","error"]
    out_path = Path(args.out_csv)
    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_fields, delimiter=";")
        w.writeheader()
        for row in rows:
            cq_id = (row.get("cq_id") or "").strip()
            res = results_by_id.get(cq_id, {"passed": False, "error": "missing_result", "row_count": ""})
            w.writerow({
                "cq_id": cq_id,
                "use_case": row.get("use_case", ""),
                "scenario_step": row.get("scenario_step", ""),
                "dimension": row.get("dimension", ""),
                "question": row.get("question", ""),
                "sparql": row.get("sparql", ""),
                "pass_rule": row.get("pass_rule", ""),
                "notes": row.get("notes", ""),
                "result": "PASS" if res.get("passed") else "FAIL",
                "error": res.get("error", ""),
            })

    elapsed = time.time() - t0
    log(f"Finished. PASS={ok} FAIL={fail} ERR={err} | total={total} | elapsed={int(elapsed)}s")
    log(f"Output written to: {out_path.resolve()}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python
# pcap_to_http_json.py

import sys
import json
import subprocess
from urllib.parse import urlparse, parse_qsl
import os
import base64
import time

RUN_TIMESTAMP_MS = int(time.time() * 1000)


def first_or_none(value):
    """In tshark JSON, every field is usually an array of values. Return the first or None."""
    if isinstance(value, list) and value:
        return value[0]
    return value


def as_list(value):
    """Always return a list."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def byte_sequence_field_to_base64(field_values):
    """
    Convert tshark 'Byte sequence' fields (http.file_data, http2.body.reassembled.data)
    into a base64 string.

    Typical tshark input:
      "3c 68 74 6d 6c 3e ..." or "3c:68:74:6d:6c:3e"

    Output:
      "PHRtbD4uLi4=" (base64)
    """
    values = as_list(field_values)
    if not values:
        return None

    # Join everything into a single string
    joined = "".join(values)

    # Normalize: remove colons, tabs, and collapse multiple spaces
    hex_str = joined.replace(":", " ").replace("\t", " ")
    hex_str = " ".join(hex_str.split())

    try:
        body_bytes = bytes.fromhex(hex_str)
    except ValueError:
        return None

    # Convert to base64
    return base64.b64encode(body_bytes).decode("ascii")


def build_uri_struct(full_url, scheme_hint=None, authority_hint=None, path_hint=None):
    """
    Build a `uri` structure compatible with the ontology:
      {
        "full": "...",
        "scheme": "...",
        "authority": "...",
        "path": "...",
        "params": [{ "name": "...", "value": "..." }],
        "queryRaw": "a=1&b=2"
      }
    """
    if not full_url and authority_hint and path_hint:
        # Fallback: if we don't have full_url but we do have host + path
        full_url = f"http://{authority_hint}{path_hint}"

    full_url = full_url or ""
    parsed = urlparse(full_url)

    scheme = scheme_hint or parsed.scheme or None
    authority = authority_hint or parsed.netloc or None
    path = path_hint or parsed.path or None
    query_raw = parsed.query or None

    params = []
    if query_raw:
        for name, value in parse_qsl(query_raw, keep_blank_values=True):
            params.append({"name": name, "value": value})

    uri_obj = {"full": full_url}

    if scheme:
        uri_obj["scheme"] = scheme
    if authority:
        uri_obj["authority"] = authority
    if path:
        uri_obj["path"] = path
    if query_raw:
        uri_obj["queryRaw"] = query_raw
    if params:
        uri_obj["params"] = params

    return uri_obj


def normalize_headers(headers):
    """
    Normalize headers into [{ name, value }] with header name in lower-case.
    """
    out = []
    for h in headers or []:
        name = h.get("name")
        if not name:
            continue
        out.append(
            {
                "name": str(name).lower(),
                "value": str(h.get("value", "")),
            }
        )
    return out


def run_tshark(pcap_path, sslkeys_path):
    """
    Run tshark on the provided pcap file, using the TLS key log file
    to decrypt HTTP/1.1 and HTTP/2 traffic.
    Returns raw tshark JSON data.
    """
    tshark_bin = os.getenv("TSHARK_BIN", "tshark")

    cmd = [
        tshark_bin,
        "-r", pcap_path,
        "-o", f"tls.keylog_file:{sslkeys_path}",
        # Broad filter: capture every packet with http or http2
        "-Y", "http || http2",
        "-T", "json",
        # Common fields
        "-e", "frame.number",
        "-e", "ip.src",
        "-e", "ip.dst",
        "-e", "tcp.srcport",
        "-e", "tcp.dstport",
        "-e", "tcp.stream",
        # HTTP/1.x request
        "-e", "http.request.full_uri",
        "-e", "http.request.method",
        "-e", "http.request.version",
        "-e", "http.host",
        "-e", "http.request.uri",
        "-e", "http.user_agent",
        "-e", "http.cookie",
        "-e", "http.referer",
        # HTTP/1.x response
        "-e", "http.response.code",
        "-e", "http.response.phrase",
        "-e", "http.response.version",
        "-e", "http.server",
        "-e", "http.content_type",
        "-e", "http.set_cookie",
        "-e", "http.location",
        "-e", "http.content_length_header",
        "-e", "http.request_in",
        # HTTP/1.x body (if available)
        "-e", "http.file_data",
        # HTTP/2 common
        "-e", "http2.streamid",
        # HTTP/2 request headers
        "-e", "http2.headers.method",
        "-e", "http2.headers.scheme",
        "-e", "http2.headers.authority",
        "-e", "http2.headers.path",
        # HTTP/2 response headers
        "-e", "http2.headers.status",
        "-e", "http2.headers.server",
        "-e", "http2.headers.content_type",
        "-e", "http2.headers.set_cookie",
        "-e", "http2.headers.location",
        "-e", "http2.headers.content_length",
        # IMPORTANT: do not use http2.request_in (not available on your Docker tshark)
        # HTTP/2 body (if available)
        "-e", "http2.body.reassembled.data",
    ]

    print(f"[DEBUG] Running: {' '.join(cmd)}", file=sys.stderr)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as e:
        raise RuntimeError(f"Cannot find tshark binary '{tshark_bin}': {e}")
    except Exception as e:
        raise RuntimeError(f"Error executing tshark: {e}")

    if result.returncode != 0:
        raise RuntimeError(
            f"tshark failed with code {result.returncode}: {result.stderr}"
        )

    if not result.stdout.strip():
        print("[DEBUG] tshark returned empty stdout", file=sys.stderr)
        return []

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to decode JSON from tshark: {e}")

    print(f"[DEBUG] tshark returned {len(data)} packets", file=sys.stderr)
    return data


def http_request_from_layers(layers):
    """
    Convert a single tshark JSON record into an HttpRequest object (Node schema).
    If this packet is not a valid HTTP request, return (None, None).

    Also returns the logical key used to match the response:
      - HTTP/1.x : ('http1', frame.number)
      - HTTP/2   : ('http2', tcp.stream, streamid)
    """
    frame_no = first_or_none(layers.get("frame.number"))
    if not frame_no:
        return None, None

    ip_src = first_or_none(layers.get("ip.src"))
    ip_dst = first_or_none(layers.get("ip.dst"))
    tcp_src = first_or_none(layers.get("tcp.srcport"))
    tcp_dst = first_or_none(layers.get("tcp.dstport"))
    tcp_stream = first_or_none(layers.get("tcp.stream"))

    # HTTP/1.x
    http1_method = first_or_none(layers.get("http.request.method"))
    http1_full_uri = first_or_none(layers.get("http.request.full_uri"))
    http1_host = first_or_none(layers.get("http.host"))
    http1_path = first_or_none(layers.get("http.request.uri"))
    http1_version = first_or_none(layers.get("http.request.version"))
    http1_ua = first_or_none(layers.get("http.user_agent"))
    http1_cookie = first_or_none(layers.get("http.cookie"))
    http1_referer = first_or_none(layers.get("http.referer"))

    # HTTP/2
    h2_method = first_or_none(layers.get("http2.headers.method"))
    h2_scheme = first_or_none(layers.get("http2.headers.scheme"))
    h2_authority = first_or_none(layers.get("http2.headers.authority"))
    h2_path = first_or_none(layers.get("http2.headers.path"))
    h2_streamid = first_or_none(layers.get("http2.streamid"))

    protocol = None
    method = None
    http_version = None
    uri = None
    headers = []
    connection_auth = None
    key = None

    if http1_method:
        protocol = "http1"
        method = http1_method
        http_version = http1_version or "HTTP/1.1"

        uri = build_uri_struct(
            full_url=http1_full_uri,
            scheme_hint=None,
            authority_hint=http1_host,
            path_hint=http1_path,
        )

        if http1_host:
            headers.append({"name": "host", "value": http1_host})
        if http1_ua:
            headers.append({"name": "user-agent", "value": http1_ua})
        if http1_cookie:
            headers.append({"name": "cookie", "value": http1_cookie})
        if http1_referer:
            headers.append({"name": "referer", "value": http1_referer})

        if ip_dst and tcp_dst:
            connection_auth = f"{ip_dst}:{tcp_dst}"

        key = ("http1", frame_no)

    elif h2_method:
        protocol = "http2"
        method = h2_method
        http_version = "HTTP/2"

        full_url = None
        if h2_scheme and h2_authority and h2_path:
            full_url = f"{h2_scheme}://{h2_authority}{h2_path}"
        elif h2_authority and h2_path:
            full_url = f"https://{h2_authority}{h2_path}"

        uri = build_uri_struct(
            full_url=full_url,
            scheme_hint=h2_scheme,
            authority_hint=h2_authority,
            path_hint=h2_path,
        )

        # Pseudo-headers in the header list
        if h2_authority:
            headers.append({"name": ":authority", "value": h2_authority})
        if h2_scheme:
            headers.append({"name": ":scheme", "value": h2_scheme})
        if h2_path:
            headers.append({"name": ":path", "value": h2_path})

        if ip_dst and tcp_dst:
            connection_auth = f"{ip_dst}:{tcp_dst}"

        # HTTP/2 key: (tcp.stream, streamid)
        stream_key = tcp_stream if tcp_stream is not None else frame_no
        key = ("http2", stream_key, h2_streamid or "0")

    else:
        # Not an HTTP request we care about
        return None, None

    base_id = f"pcap-{protocol}-{RUN_TIMESTAMP_MS}-{frame_no}"
    if protocol == "http2" and h2_streamid:
        base_id += f"-s{h2_streamid}"

    http_request = {
        "id": str(base_id),
        "method": str(method).upper(),
        "httpVersion": http_version,
        "uri": uri,
    }

    norm_headers = normalize_headers(headers)
    if norm_headers:
        http_request["requestHeaders"] = norm_headers

    if connection_auth:
        http_request["connection"] = {"authority": connection_auth.lower()}

    return key, http_request


def attach_http1_response(req, layers):
    """
    Attach an HTTP/1.x response to an existing request object.
    """
    status_code = first_or_none(layers.get("http.response.code"))
    if not status_code:
        return

    reason = first_or_none(layers.get("http.response.phrase"))
    version = first_or_none(layers.get("http.response.version")) or "HTTP/1.1"
    server = first_or_none(layers.get("http.server"))
    content_type = first_or_none(layers.get("http.content_type"))
    location = first_or_none(layers.get("http.location"))
    content_length = first_or_none(layers.get("http.content_length_header"))
    set_cookie_all = as_list(layers.get("http.set_cookie"))

    headers = []
    if server:
        headers.append({"name": "server", "value": server})
    if content_type:
        headers.append({"name": "content-type", "value": content_type})
    if location:
        headers.append({"name": "location", "value": location})
    if content_length:
        headers.append({"name": "content-length", "value": content_length})
    for sc in set_cookie_all:
        if sc:
            headers.append({"name": "set-cookie", "value": sc})

    resp_obj = {
        "statusCode": int(status_code),
        "httpVersion": version,
    }
    if reason:
        resp_obj["reasonPhrase"] = reason

    norm_headers = normalize_headers(headers)
    if norm_headers:
        resp_obj["responseHeaders"] = norm_headers

    # HTTP/1.x body in base64
    body_b64 = byte_sequence_field_to_base64(layers.get("http.file_data"))
    if body_b64:
        resp_obj["body"] = body_b64

    req["response"] = resp_obj


def attach_http2_response(req, layers):
    """
    Attach an HTTP/2 response to an existing request object.
    """
    status_code = first_or_none(layers.get("http2.headers.status"))
    if not status_code:
        return

    server = first_or_none(layers.get("http2.headers.server"))
    content_type = first_or_none(layers.get("http2.headers.content_type"))
    location = first_or_none(layers.get("http2.headers.location"))
    content_length = first_or_none(layers.get("http2.headers.content_length"))
    set_cookie_all = as_list(layers.get("http2.headers.set_cookie"))

    headers = []
    if server:
        headers.append({"name": "server", "value": server})
    if content_type:
        headers.append({"name": "content-type", "value": content_type})
    if location:
        headers.append({"name": "location", "value": location})
    if content_length:
        headers.append({"name": "content-length", "value": content_length})
    for sc in set_cookie_all:
        if sc:
            headers.append({"name": "set-cookie", "value": sc})

    resp_obj = {
        "statusCode": int(status_code),
        "httpVersion": "HTTP/2",
    }

    norm_headers = normalize_headers(headers)
    if norm_headers:
        resp_obj["responseHeaders"] = norm_headers

    # HTTP/2 body in base64
    body_b64 = byte_sequence_field_to_base64(layers.get("http2.body.reassembled.data"))
    if body_b64:
        resp_obj["body"] = body_b64

    req["response"] = resp_obj


def extract_http_from_packets(tshark_data):
    """
    Single pass over packets:
      - identify requests and store them in a map
      - identify responses and attach them to the corresponding requests
    """
    requests_map = {}

    for pkt in tshark_data:
        layers = pkt.get("_source", {}).get("layers", {})

        # 1) If it is a request, create it
        key, req_obj = http_request_from_layers(layers)
        if key and req_obj:
            # If it already exists, do not overwrite it (first request wins)
            if key not in requests_map:
                requests_map[key] = req_obj

        # 2) If it is an HTTP/1.x response, link it using http.request_in
        status_http1 = first_or_none(layers.get("http.response.code"))
        if status_http1:
            req_frame = first_or_none(layers.get("http.request_in"))
            if req_frame:
                k = ("http1", req_frame)
                req = requests_map.get(k)
                if req is not None:
                    attach_http1_response(req, layers)

        # 3) If it is an HTTP/2 response, link it using (tcp.stream, streamid)
        status_http2 = first_or_none(layers.get("http2.headers.status"))
        if status_http2:
            streamid = first_or_none(layers.get("http2.streamid")) or "0"
            tcp_stream = first_or_none(layers.get("tcp.stream"))
            if tcp_stream is not None:
                k2 = ("http2", tcp_stream, streamid)
                req2 = requests_map.get(k2)
                if req2 is not None:
                    attach_http2_response(req2, layers)

    return list(requests_map.values())


def main():
    if len(sys.argv) < 3:
        print(
            "Usage: python pcap_to_http_json.py <pcap_path> <sslkeys_path>",
            file=sys.stderr,
        )
        sys.exit(1)

    pcap_path = sys.argv[1]
    sslkeys_path = sys.argv[2]

    print(f"[DEBUG] pcap_path={pcap_path}", file=sys.stderr)
    print(f"[DEBUG] sslkeys_path={sslkeys_path}", file=sys.stderr)

    try:
        tshark_data = run_tshark(pcap_path, sslkeys_path)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(2)

    http_requests = extract_http_from_packets(tshark_data)

    print(
        f"[DEBUG] Built {len(http_requests)} HttpRequest objects (with responses where available)",
        file=sys.stderr,
    )

    # Output: list of HttpRequest objects, ready for /http-requests/ingest-http
    print(json.dumps(http_requests))


if __name__ == "__main__":
    main()

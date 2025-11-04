#!/usr/bin/env bash
# Usage: ./capture_ping.sh <namespace> <target>

NS="${1:-capture}"      # network namespace name
TARGET="${2:-8.8.8.8}"  # ping destination
PCAP="traffic_${NS}.pcap"

echo "[*] Capturing on namespace: $NS → pinging $TARGET"
sudo nsenter -t 1 -n tcpdump -i veth-"$NS" -w "$PCAP" -U &
TCPDUMP_PID=$!

# run ping inside the namespace
sudo ip netns exec "$NS" ping -c 5 "$TARGET"

# stop tcpdump cleanly
sudo kill -INT "$TCPDUMP_PID"
wait "$TCPDUMP_PID" 2>/dev/null

echo "[*] Capture saved to: $PCAP"

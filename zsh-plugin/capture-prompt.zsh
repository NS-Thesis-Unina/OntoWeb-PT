# ----------------------------------------------------------
#   ZSH Capture Framework 
# ----------------------------------------------------------
# Usage:
#   capture_activate /path/to/logdir myenv
#   capture_deactivate
# ----------------------------------------------------------


CAPTURE_ACTIVE=0
CAPTURE_CMD_INDEX=0


capture_activate() {
    base_dir="${1:-/tmp/log-collector}"
    export VIRTUAL_ENV_PROMPT="${2:-capture}"

    session_timestamp=$(date +"%Y%m%d_%H%M%S")
    log_dir="${base_dir}/${VIRTUAL_ENV_PROMPT}_${session_timestamp}"
    mkdir -p "$log_dir"

    # TODO: Currently, only one environment can be managed at a time.
    sudo ip netns add "$VIRTUAL_ENV_PROMPT"
    sudo ip link add veth-"$VIRTUAL_ENV_PROMPT" type veth peer name veth-ns-"$VIRTUAL_ENV_PROMPT"
    sudo ip link set veth-ns-"$VIRTUAL_ENV_PROMPT" netns "$VIRTUAL_ENV_PROMPT"
    sudo ip addr add 10.0.0.1/24 dev veth-"$VIRTUAL_ENV_PROMPT"
    sudo ip link set veth-"$VIRTUAL_ENV_PROMPT" up
    sudo ip netns exec "$VIRTUAL_ENV_PROMPT" ip addr add 10.0.0.2/24 dev veth-ns-"$VIRTUAL_ENV_PROMPT"
    sudo ip netns exec "$VIRTUAL_ENV_PROMPT" ip link set veth-ns-"$VIRTUAL_ENV_PROMPT" up
    sudo ip netns exec "$VIRTUAL_ENV_PROMPT" ip link set lo up
    sudo ip netns exec "$VIRTUAL_ENV_PROMPT" ip route add default via 10.0.0.1
    sudo iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -j MASQUERADE
    sudo iptables -A FORWARD -i veth-"$VIRTUAL_ENV_PROMPT" -j ACCEPT
    sudo iptables -A FORWARD -o veth-"$VIRTUAL_ENV_PROMPT" -j ACCEPT
    sudo mkdir -p /etc/netns/"$VIRTUAL_ENV_PROMPT"
    sudo bash -c "echo 'nameserver 8.8.8.8' > /etc/netns/${VIRTUAL_ENV_PROMPT}/resolv.conf"
    sudo bash -c "echo 'nameserver 1.1.1.1' >> /etc/netns/${VIRTUAL_ENV_PROMPT}/resolv.conf"

    if [ -z "${CAPTURE_DISABLED-}" ]; then
        if [ -z "${_OLD_VIRTUAL_PS1-}" ]; then
            _OLD_VIRTUAL_PS1="${PS1-}"
        fi
        PS1="(${VIRTUAL_ENV_PROMPT}) ${PS1-}"
        export PS1
        CAPTURE_ACTIVE=1
        
        echo "[capture] Environment: (${VIRTUAL_ENV_PROMPT})"
        echo "[capture] Logging in: $log_dir"
    fi
}


capture_deactivate() {
    if [ -n "${_OLD_VIRTUAL_PS1-}" ]; then
        PS1="${_OLD_VIRTUAL_PS1}"
        export PS1
        unset _OLD_VIRTUAL_PS1
        CAPTURE_ACTIVE=0
        echo "[capture] Prompt deactivated"
    fi

    # TODO: Check if correct
    sudo iptables -t nat -D POSTROUTING -s 10.0.0.0/24 -j MASQUERADE 2>/dev/null || true
    sudo iptables -D FORWARD -i veth-"$VIRTUAL_ENV_PROMPT" -j ACCEPT 2>/dev/null || true
    sudo iptables -D FORWARD -o veth-"$VIRTUAL_ENV_PROMPT" -j ACCEPT 2>/dev/null || true
    sudo ip netns del "$VIRTUAL_ENV_PROMPT" 2>/dev/null || true
    sudo ip link delete veth-"$VIRTUAL_ENV_PROMPT" 2>/dev/null || true

}


preexec() {
    if (( CAPTURE_ACTIVE == 1 )); then
        case "$1" in
            capture_deactivate|capture_activate)
                return
                ;;
        esac
        
        CAPTURE_CMD_INDEX=$((CAPTURE_CMD_INDEX + 1))
        
        
        ts=$(date +"%Y-%m-%d %H:%M:%S")
        index_padded=$(printf "%03d" "$CAPTURE_CMD_INDEX")
        output_file="${log_dir}/index_${index_padded}.txt"

        # { eval "$1" >"$output_file" 2>&1; } || true


        echo "{\"index\":${CAPTURE_CMD_INDEX},\"timestamp\":\"${ts}\",\"command\":$(jq -Rn --arg c "$1" '$c'),\"output\":${output_file}}" >> "${log_dir}/commands.ndjson"

    fi
}

trap capture_deactivate EXIT

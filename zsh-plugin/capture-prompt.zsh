# ----------------------------------------------------------
#   ZSH Capture Framework 
# ----------------------------------------------------------
# Usage:
#   capture_activate /path/to/logdir myenv
#   capture_deactivate
# ----------------------------------------------------------


CAPTURE_ACTIVE=0


capture_activate() {

    # INPUT PARAMS
    base_dir="${1:-/tmp/log-collector}"
    virtual_env_prompt="${2:-capture}"

    # Prepare log dir
    session_timestamp=$(date +"%Y%m%d_%H%M%S")
    log_dir="${base_dir}/${virtual_env_prompt}_${session_timestamp}"
    mkdir -p "$log_dir"
    mkdir "$log_dir/ZDOTDIR"

    # Copy zsh conf files
    setopt extended_glob
    local zfiles=(
        ${ZDOTDIR:-~}/.zsh*(.N)
        ${ZDOTDIR:-~}/.zlog*(.N)
        ${ZDOTDIR:-~}/.zprofile(.N)
    )
    for zfile in $zfiles; do
        cp $zfile "$log_dir/ZDOTDIR/"
    done

    # Namespace creation
    sudo ip netns add "$virtual_env_prompt"
    sudo ip link add veth-"$virtual_env_prompt" type veth peer name veth-ns-"$virtual_env_prompt"
    sudo ip link set veth-ns-"$virtual_env_prompt" netns "$virtual_env_prompt"
    sudo ip addr add 10.0.0.1/24 dev veth-"$virtual_env_prompt"
    sudo ip link set veth-"$virtual_env_prompt" up
    sudo ip netns exec "$virtual_env_prompt" ip addr add 10.0.0.2/24 dev veth-ns-"$virtual_env_prompt"
    sudo ip netns exec "$virtual_env_prompt" ip link set veth-ns-"$virtual_env_prompt" up
    sudo ip netns exec "$virtual_env_prompt" ip link set lo up
    sudo ip netns exec "$virtual_env_prompt" ip route add default via 10.0.0.1
    sudo iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -j MASQUERADE
    sudo iptables -A FORWARD -i veth-"$virtual_env_prompt" -j ACCEPT
    sudo iptables -A FORWARD -o veth-"$virtual_env_prompt" -j ACCEPT
    sudo mkdir -p /etc/netns/"$virtual_env_prompt"
    sudo bash -c "echo 'nameserver 8.8.8.8' > /etc/netns/${virtual_env_prompt}/resolv.conf"
    sudo bash -c "echo 'nameserver 1.1.1.1' >> /etc/netns/${virtual_env_prompt}/resolv.conf"

    # add source to capture env
    script_path="${(%):-%x}"
    cp $script_path "$log_dir/ZDOTDIR/"
    echo "source $log_dir/ZDOTDIR/capture-prompt.zsh && capture_config $log_dir $virtual_env_prompt" >> "$log_dir/ZDOTDIR/.zshrc"

    echo "[capture] Logging in: $log_dir"
    echo "[capture] Environment: (${virtual_env_prompt})"

    # start capture env
    script -q -f "$log_dir/session.log" -c "sudo ip netns exec \"$virtual_env_prompt\" sudo -u \"$USER\" env ZDOTDIR=\"$log_dir/ZDOTDIR\" zsh -i"

}


capture_config() {
    
    export LOG_DIRECTORY="$1"
    typeset -gi CAPTURE_CMD_INDEX=1
    export VIRTUAL_ENV_PROMPT="${2:-capture}"

    if [ -z "${CAPTURE_DISABLED-}" ]; then
        if [ -z "${_OLD_VIRTUAL_PS1-}" ]; then
            _OLD_VIRTUAL_PS1="${PS1-}"
        fi
        setopt PROMPT_SUBST

        PS1='[$CAPTURE_CMD_INDEX] ('"$VIRTUAL_ENV_PROMPT"') '"${PS1-}"''
        export PS1
        CAPTURE_ACTIVE=1
    fi

}

# sudo ip netns exec \"$virtual_env_prompt\" env ZDOTDIR=\"$log_dir/ZDOTDIR\" zsh -i


capture_deactivate() {
    if [ -n "${_OLD_VIRTUAL_PS1-}" ]; then
        PS1="${_OLD_VIRTUAL_PS1}"
        export PS1
        unset _OLD_VIRTUAL_PS1
        CAPTURE_ACTIVE=0
        echo "[capture] Prompt deactivated"
    fi

    sudo iptables -t nat -D POSTROUTING -s 10.0.0.0/24 -j MASQUERADE 
    sudo iptables -D FORWARD -i veth-"$VIRTUAL_ENV_PROMPT" -j ACCEPT 
    sudo iptables -D FORWARD -o veth-"$VIRTUAL_ENV_PROMPT" -j ACCEPT 
    sudo ip link delete veth-"$VIRTUAL_ENV_PROMPT"
    sudo ip netns delete "$VIRTUAL_ENV_PROMPT" 

    exit    

}


clear() {
    if (( CAPTURE_ACTIVE == 1 )); then
        echo "[capture] Command 'clear' is not allowed while capture is active."
        return 1
    fi
    command clear "$@"
}


preexec() {
    if (( CAPTURE_ACTIVE == 1 )); then
        case "$1" in
            capture_deactivate|capture_activate)
                return
                ;;
        esac

        (( CAPTURE_CMD_INDEX++ ))

        ts=$(date +"%Y-%m-%d %H:%M:%S")
        pcap_file="${LOG_DIRECTORY}/traffic_${CAPTURE_CMD_INDEX}.pcap"
        output_file="${LOG_DIRECTORY}/index_${index_padded}.log"


        # Run the command normally (we're already inside namespace)
        # eval "$1" | tee "$output_file"
        CMD_STATUS=$?

        echo "{\"index\":${CAPTURE_CMD_INDEX},\"timestamp\":\"${ts}\",\"command\":$(jq -Rn --arg c "$1" '$c'),\"pcap_file\":${pcap_file}}" >> "$LOG_DIRECTORY/commands.ndjson"
    
    fi
}

trap capture_deactivate EXIT

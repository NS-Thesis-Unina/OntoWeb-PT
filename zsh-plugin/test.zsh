# ----------------------------------------------------------
#   ZSH Capture Framework 
# ----------------------------------------------------------
# Usage:
#   capture_activate /path/to/logdir myenv
#   capture_deactivate
# ----------------------------------------------------------

CAPTURE_ACTIVE=0
CAPTURE_CMD_INDEX=0
TCPDUMP_PID=""

capture_activate() {
    base_dir="${1:-/tmp/log-collector}"
    virtual_env_prompt="${2:-capture}"

    session_timestamp=$(date +"%Y%m%d_%H%M%S")
    log_dir="${base_dir}/${virtual_env_prompt}_${session_timestamp}"
    mkdir -p "$log_dir/ZDOTDIR"

    # Copy zsh configuration files
    setopt extended_glob
    local zfiles=(
        ${ZDOTDIR:-~}/.zsh*(.N)
        ${ZDOTDIR:-~}/.zlog*(.N)
        ${ZDOTDIR:-~}/.zprofile(.N)
    )
    for zfile in $zfiles; do cp "$zfile" "$log_dir/ZDOTDIR/" 2>/dev/null; done

    # Copy current script to env
    script_path="${(%):-%x}"
    cp "$script_path" "$log_dir/ZDOTDIR/"

    echo "source $log_dir/ZDOTDIR/test.zsh && capture_config $log_dir $virtual_env_prompt" >> "$log_dir/ZDOTDIR/.zshrc"

    echo "[capture] Logging in: $log_dir"
    echo "[capture] Environment: (${virtual_env_prompt})"

    script -q -f "$log_dir/session.log" -c "env ZDOTDIR=\"$log_dir/ZDOTDIR\" zsh -i"
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
        PS1='[$CAPTURE_CMD_INDEX] ('"$VIRTUAL_ENV_PROMPT"') '"${PS1-}"
        export PS1
        CAPTURE_ACTIVE=1
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
    exit
}


clear() {
    if (( CAPTURE_ACTIVE == 1 )); then
        echo "[capture] Command 'clear' is not allowed while capture is active."
        return 1
    fi
    command clear "$@"
}


# ----------------------------------------------------------
#   Hooks
# ----------------------------------------------------------


preexec() {
    if (( CAPTURE_ACTIVE == 1 )); then
        case "$1" in
            capture_deactivate|capture_activate|clear)
                return ;;
        esac

        CURRENT_CMD="$1"
        CURRENT_TS=$(date +"%Y-%m-%d %H:%M:%S")
        CURRENT_PCAP="${LOG_DIRECTORY}/traffic_${CAPTURE_CMD_INDEX}.pcap"

        echo "[capture] → Starting tcpdump for command: $CURRENT_CMD"
        echo "[capture] → Saving to: $CURRENT_PCAP"

        sudo tcpdump -U -i any -w "$CURRENT_PCAP" >/dev/null 2>&1 &
        TCPDUMP_PID=$!
        export TCPDUMP_PID CURRENT_CMD CURRENT_TS CURRENT_PCAP
    fi
}


precmd() {
    if (( CAPTURE_ACTIVE == 1 )) && [[ -n "$TCPDUMP_PID" ]]; then
        local CMD_STATUS=$?

        kill "$TCPDUMP_PID" >/dev/null 2>&1
        wait "$TCPDUMP_PID" 2>/dev/null
        echo "[capture] → tcpdump stopped (PID $TCPDUMP_PID)"
        echo "[capture] → Command exit status: $CMD_STATUS"

        echo "{\"index\":${CAPTURE_CMD_INDEX},\"timestamp\":\"${CURRENT_TS}\",\"command\":$(jq -Rn --arg c \"$CURRENT_CMD\" '$c'),\"pcap_file\":\"${CURRENT_PCAP}\",\"status\":${CMD_STATUS}}" >> "$LOG_DIRECTORY/commands.ndjson"

        (( CAPTURE_CMD_INDEX++ ))
        unset TCPDUMP_PID
    fi
}


trap capture_deactivate EXIT

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
}


preexec() {
    if (( CAPTURE_ACTIVE == 1 )); then
        CAPTURE_CMD_INDEX=$((CAPTURE_CMD_INDEX + 1))
        
        ts=$(date +"%Y-%m-%d %H:%M:%S")

        echo "{\"index\":${CAPTURE_CMD_INDEX},\"timestamp\":\"${ts}\",\"command\":$(jq -Rn --arg c "$1" '$c')}" >> "${log_dir}/commands.ndjson"

    fi
}

trap capture_deactivate EXIT

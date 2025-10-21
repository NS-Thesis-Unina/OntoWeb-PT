#!/bin/zsh

capture_activate() {
    export CAPTURE_ENV_PROMPT="capture"

    if [ -z "${CAPTURE_DISABLED-}" ]; then
        if [ -z "${_OLD_VIRTUAL_PS1-}" ]; then
            _OLD_VIRTUAL_PS1="${PS1-}"
        fi

        PS1="(${CAPTURE_ENV_PROMPT}) ${PS1-}"

        export PS1
        echo "[capture] Prompt activated → (${CAPTURE_ENV_PROMPT})"
    fi
}


capture_deactivate() {
    if [ -n "${_OLD_VIRTUAL_PS1-}" ]; then
        PS1="${_OLD_VIRTUAL_PS1}"
        export PS1
        unset _OLD_VIRTUAL_PS1
        echo "[capture] Prompt deactivated"
    else
        echo "[capture] No active capture prompt to deactivate"
    fi
}

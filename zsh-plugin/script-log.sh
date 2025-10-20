#!/bin/zsh
# Path of the counter file
count_file=/tmp/.zsh_session_count

# Creation of tmp dir for logs
if [ ! -d /tmp/log-collector ]; then
    mkdir -p /tmp/log-collector
fi

# If the file does not exist then create a counter set to value 1
if [[ ! -e $count_file ]] && [ -f /tmp/script_running ]; then
  echo "1" > $count_file
fi
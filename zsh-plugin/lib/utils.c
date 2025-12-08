#define _GNU_SOURCE
#include "utils.h"

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdarg.h>
#include <string.h>
#include <stdbool.h>


int verbose_flag = 0;

/**
 * @brief Set the Verbose object
 * 
 * @param enabled 
 */
void setVerbose(int enabled) {
    verbose_flag = enabled;
}


int verbose(const char * restrict format, ...) {
    if( !verbose_flag)
        return 0;

    va_list args;
    va_start(args, format);
    int ret = vprintf(format, args);
    va_end(args);

    return ret;
}





char* get_parent_shell_path() {
    pid_t ppid = getppid();
    char linkpath[256];
    char buf[512];

    // 1. /proc/<ppid>/exe -> real executable path
    snprintf(linkpath, sizeof(linkpath), "/proc/%d/exe", ppid);
    ssize_t len = readlink(linkpath, buf, sizeof(buf) - 1);
    if (len != -1) {
        buf[len] = '\0';
        return strdup(buf);   // caller must free()
    }

    // 2. fallback -> $SHELL
    const char *env_shell = getenv("SHELL");
    if (env_shell && env_shell[0] != '\0') {
        return strdup(env_shell);
    }

    // 3. last resort
    return strdup("/bin/sh");
}
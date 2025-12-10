#define _GNU_SOURCE
#include "utils.h"

#include <stdio.h>
#include <stdlib.h>
#include <stddef.h>
#include <unistd.h>
#include <stdarg.h>
#include <string.h>
#include <stdbool.h>


int verbose_flag = 0;


void setVerbose(int enabled) {
    verbose_flag = enabled;
}

/**
*  Implementation guide: 
*  https://stackoverflow.com/questions/36095915/implementing-verbose-in-c 
**/
int verbose (const char * restrict format, ...) {
    if (!verbose_flag) {
        return 0;
    }

    va_list args;
    va_start(args, format);
    int ret = vprintf(format, args);
    va_end(args);

    return ret;
}


int get_parent_shell_path (char *out, size_t out_size) {
    if (!out || out_size == 0)
        return -1;

    pid_t ppid = getppid();
    char linkpath[256];
    char buf[512];

    // 1. Try to read actual executable path of parent shell
    snprintf(linkpath, sizeof(linkpath), "/proc/%d/exe", ppid);
    ssize_t len = readlink(linkpath, buf, sizeof(buf) - 1);

    if (len > 0) {
        buf[len] = '\0';
        snprintf(out, out_size, "%s", buf);
        return 0;
    }

    // 2. Fallback to SHELL env variable
    const char *env_shell = getenv("SHELL");
    if (env_shell && env_shell[0] != '\0') {
        snprintf(out, out_size, "%s", env_shell);
        return 0;
    }

    // 3. Default fallback
    snprintf(out, out_size, "/bin/sh");
    return 0;
}

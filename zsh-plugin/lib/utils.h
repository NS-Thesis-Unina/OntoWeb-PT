#ifndef UTILS_H
#define UTILS_H


/**
 * @brief Enable or disable verbose output.
 *
 * @param enabled       true to enable verbose logging, false to disable it.
 */
void setVerbose(int enabled);


/**
 * @brief Print a message only when verbose mode is enabled.
 *
 * @param msg           Null-terminated message to print.
 * @return              The number of bytes printed when verbose mode is enabled,
 *                      or 0 when verbose mode is disabled.
 */
int verbose(const char * restrict format, ...);


// Returns a heap-allocated full path to the parent shell executable.
// Caller MUST free() the returned string.
/**
 * @brief Get the parent shell path object
 * 
 * @return char* 
 */
char* get_parent_shell_path();

#endif
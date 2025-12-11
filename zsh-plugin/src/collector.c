// http://github.com/romkatv/powerlevel10k/issues/2336
#define _GNU_SOURCE

#include <pwd.h>
#include <grp.h>
#include <pty.h>
#include <time.h>
#include <stdio.h>
#include <sched.h>
#include <errno.h> // check if delete
#include <unistd.h>
#include <stdlib.h>
#include <signal.h>
#include <termios.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/epoll.h>
#include <sys/types.h>
// vedere come gestire meglio la source
#include <string.h>

#include "cmdline.h"
#include "utils.h"


// Modify to include also the others
// TODO: Tutta sta roba si può levare perché basta la detect shell sul padre
// TODO: improve code quality
// TODO: You can check by SUDO_COMMAND
// https://www.sudo.ws/docs/man/sudo.man/#ENVIRONMENT
static int read_comm(pid_t pid, char *buf, size_t size) {
    char path[256];
    snprintf(path, sizeof(path), "/proc/%d/comm", pid);
    FILE *f = fopen(path, "r");
    if (!f) return -1;

    fgets(buf, size, f);
    buf[strcspn(buf, "\n")] = 0;
    fclose(f);
    return 0;
}


// check it
static pid_t read_ppid(pid_t pid) {
    char path[256], key[32];
    snprintf(path, sizeof(path), "/proc/%d/status", pid);

    FILE *f = fopen(path, "r");
    if (!f) return -1;

    pid_t ppid = -1;

    while (fscanf(f, "%31s", key) == 1) {
        if (strcmp(key, "PPid:") == 0) {
            fscanf(f, "%d", &ppid);
            break;
        }
        // skip rest of line
        fscanf(f, "%*[^\n]\n");
    }

    fclose(f);
    return ppid;
}

// https://stackoverflow.com/questions/3357737/dropping-root-privileges
// TODO: modificare path, modificare soluzione
// If root, drop priv only if sudo, otherwise no.

// https://stackoverflow.com/questions/4598001/how-do-you-find-the-original-user-through-multiple-sudo-and-su-commands
// It appear a fork, so it is necessary check the father of the father for the shell.
int drop_root_privileges(void) {
    uid_t uid = getuid();
    if (uid != 0)
        return 0;

    pid_t pid = getpid();

    pid = read_ppid(pid);
    char name[64];
    read_comm(pid, name, sizeof(name));

    if (strcmp(name, "sudo") == 0) {
        gid_t gid;
        uid_t uid;

        if ((uid = geteuid()) == 0) {
            const char *sudo_uid = secure_getenv("SUDO_UID");
            if (sudo_uid == NULL) {
                printf("environment variable `SUDO_UID` not found\n");
                return -1;
            }
            errno = 0;
            uid = (uid_t)strtoll(sudo_uid, NULL, 10);
            if (errno != 0) {
                perror("under-/over-flow in converting `SUDO_UID` to integer");
                return -1;
            }
        }

        // again, in case your program is invoked using sudo
        if ((gid = getegid()) == 0) {
            const char *sudo_gid = secure_getenv("SUDO_GID");
            if (sudo_gid == NULL) {
                printf("environment variable `SUDO_GID` not found\n");
                return -1;
            }
            errno = 0;
            gid = (gid_t)strtoll(sudo_gid, NULL, 10);
            if (errno != 0) {
                perror("under-/over-flow in converting `SUDO_GID` to integer");
                return -1;
            }
        }

        if (setgroups(0, NULL) != 0) {
            perror("setgroups");
            return -1;
        }

        if (setgid(gid) != 0) {
            perror("setgid");
            return -1;
        }
        if (setuid(uid) != 0) {
            perror("setgid");
            return -1;
        }

        // change your directory to somewhere else, just in case if you are in a
        // TODO: Check why this works
        const char *sudo_home = secure_getenv("SUDO_HOME");
        if (!sudo_home) {
            // TODO: Change with user
            setenv("HOME", "/home/nda",1);
        }

        return 1;
    }
        
    return 0;
    
}


// vedere come gestire questa variabile
#define MAX_EVENTS 4

// vedere di eliminare questa variabile
static int global_master_fd = -1;


/* -------------------------------------------
   SYNC PTY WINDOW SIZE WITH REAL TERMINAL
-------------------------------------------- */
// TODO: Improve ... Penso che la gestione della ioctl così sia sbagliata -> potrebbe esserci una race condition
// https://pvs-studio.com/en/blog/posts/cpp/0950/
void update_winsize() {
    if (global_master_fd < 0) return;

    struct winsize ws;
    if (ioctl(STDIN_FILENO, TIOCGWINSZ, &ws) == 0) {
        ioctl(global_master_fd, TIOCSWINSZ, &ws);
    }
}

// TODO: it is not save, change it
static void sig_handler(int sig) {
    if (sig == SIGWINCH) {
        update_winsize();
    }
}


int main(int argc, char ** argv) {
    printf("Program invoked as: %s\n", argv[0]);

    /* ------------------------------------------------------------------
        TODO: consider dynamic allocation for improved flexibility. 
        IDK (Lasciamo così, ci sono troppe cose da fare.)
    ------------------------------------------------------------------- */
    char capture_dir[256];
    char path_shell_capture[300];
    char capture_name[30] = "capture";
    
    /* ------------------------------------------------------------------
        Parse command-line options generated by gengetopt.
        Aborts on invalid arguments.
    ------------------------------------------------------------------- */
    struct gengetopt_args_info tool_input;
    if (cmdline_parser(argc, argv, &tool_input) != 0) {
        perror("[ERROR] Failed to parse input");
        exit(1);
    }

    /* Enable verbose logging if requested */
    setVerbose(tool_input.verbose_flag);
    verbose("Verbose flag activated");

    /* Use custom capture name if provided */
    /* TO DO: aggiungere funzione in utils e valutare allocazione dinamica */
    if (tool_input.capture_arg) {
        snprintf(capture_name, sizeof(capture_name), "%s", tool_input.capture_arg);
    }
    verbose("Capture name: %s\n", capture_name);

    if (tool_input.network_flag){
        if (unshare(CLONE_NEWNET) == -1) {
            perror("[ERROR] unshare(CLONE_NEWNET) failed");
            return -1;
        }
    }

    int ret = drop_root_privileges();
    printf("%d\n", ret);

    /* ------------------------------------------------------------------
        Determine output directory:
         - If user supplied --output, use it.
         - Otherwise generate /tmp/<name>_<timestamp>.
    ------------------------------------------------------------------- */
    /* TODO: Valutare funzione append dei path */
    /* TODO: Validazione dell'input */
    if (!tool_input.output_given){
        time_t rawtime;
        struct tm *timeinfo;
        char timestamp[64];

        time(&rawtime);
        timeinfo = localtime(&rawtime);
        strftime(timestamp, sizeof(timestamp), "%Y_%m_%d_%H_%M_%S", timeinfo);
        snprintf(capture_dir, sizeof(capture_dir),"/tmp/%s_%s", capture_name, timestamp);
    } else{
        snprintf(capture_dir, sizeof(capture_dir), "%s", tool_input.output_arg);
    }
    verbose("Output string: %s\n", capture_dir);

    /* Create the main capture directory */
    int result = mkdir(capture_dir, 0755);
    if (result == -1){
        perror("[ERROR] Failed to create the directory\n");
        exit(1);
    }
    verbose("Log are saved in path: %s\n", capture_dir);
    
    /* Open log file used to capture PTY output */
    snprintf(path_shell_capture, sizeof(path_shell_capture), "%s/collector_output.log", capture_dir);
    FILE *capture = fopen(path_shell_capture, "a");
    if (!capture) {
        perror("[ERROR] Cannot open capture log");
        exit(1);
    }
    verbose("Shell output is saved in path: %s\n", path_shell_capture);

    /* ------------------------------------------------------------------
        Spawn a real interactive shell inside a fresh PTY.
        Parent receives master_fd and controls I/O forwarding.
    ------------------------------------------------------------------- */
    int master_fd;
    pid_t pid;
    
    char shell_path[512];

    if (get_parent_shell_path(shell_path, sizeof(shell_path)) != 0) {
        fprintf(stderr, "Failed to get shell path\n");
        exit(1);
    }

    verbose("Shell path = %s\n", shell_path);

    pid = forkpty(&master_fd, NULL, NULL, NULL);
    if (pid < 0) {
        perror("[ERROR] forkpty failed");
        exit(1);
    }


    //printf("Shell = %s\n", shell_path);


    /* Child replaces itself with the invoked shell */    
    if (pid == 0) {
        execl(shell_path, shell_path, "-i", NULL);
        perror("[ERROR] execl failed");
        exit(1);
    }

    /* ---------------- PARENT ---------------- */
    /* ------------------------------------------------------------------
    TODO: Avoid the use of global_master_fd
    ------------------------------------------------------------------- */
    global_master_fd = master_fd;

    /* Sync window size immediately */
    update_winsize();

    /* Install SIGWINCH handler */
    signal(SIGWINCH, sig_handler);

    // Switch our own stdin to raw mode so keystrokes are forwarded exactly.
    struct termios orig, raw;
    tcgetattr(STDIN_FILENO, &orig);
    raw = orig;
    cfmakeraw(&raw);
    tcsetattr(STDIN_FILENO, TCSANOW, &raw);

    int ep = epoll_create1(0);
    if (ep == -1) {
        perror("[ERROR] epoll_create1 failed\n");
        tcsetattr(STDIN_FILENO, TCSANOW, &orig);
        exit(1);
    }

    // Register stdin with epoll
    struct epoll_event ev_stdin = {0};
    ev_stdin.events = EPOLLIN;
    ev_stdin.data.fd = STDIN_FILENO;
    epoll_ctl(ep, EPOLL_CTL_ADD, STDIN_FILENO, &ev_stdin);

    // Register PTY master fd with epoll
    struct epoll_event ev_pty = {0};
    ev_pty.events = EPOLLIN;
    ev_pty.data.fd = master_fd;
    epoll_ctl(ep, EPOLL_CTL_ADD, master_fd, &ev_pty);
    
    // \n to flush because you are in raw
    //printf("qualcosa\n");
    verbose("[Interactive PTY shell started. Ctrl+C, arrow keys, etc. fully work]\n");
    
    //sleep(1);


    write(master_fd, "echo qualcosa\n", strlen("echo qualcosa\n"));
    //sleep(1);
    struct epoll_event events[MAX_EVENTS];
    char buf[4096];
    int running = 1;

    // vedere se si può gestire meglio questa epoll loop
    while (running) {

        // Wait for input events (keyboard or PTY output)
        int n_events = epoll_wait(ep, events, MAX_EVENTS, -1);
        if (n_events < 0) {
            if (errno == EINTR)
                continue;
            perror("[ERROR] epoll_wait failed");
            break;
        }


        for (int i = 0; i < n_events; i++) {
            int fd = events[i].data.fd;
            uint32_t ev = events[i].events;

            // Shell closed or PTY hangup
            if (ev & (EPOLLHUP | EPOLLERR)) {
                running = 0;
                break;
            }

            // Keyboard → PTY
            if (fd == STDIN_FILENO && (ev & EPOLLIN)) {
                ssize_t n = read(STDIN_FILENO, buf, sizeof(buf));
                if (n <= 0) { 
                    running = 0; 
                    break; 
                }
                write(master_fd, buf, n);
            }
 
            // PTY → screen AND log collector
            else if (fd == master_fd && (ev & EPOLLIN)) {
                ssize_t n = read(master_fd, buf, sizeof(buf));
                if (n <= 0) { 
                    running = 0; 
                    break; 
                }
            
                // Write to terminal
                write(STDOUT_FILENO, buf, n);
            
                // Write to capture file
                fwrite(buf, 1, n, capture);
                fflush(capture);
            }
        }
    }

    // Restore terminal settings
    tcsetattr(STDIN_FILENO, TCSANOW, &orig);

    // Cleanup
    close(ep);
    waitpid(pid, NULL, 0);

    return 0;
}

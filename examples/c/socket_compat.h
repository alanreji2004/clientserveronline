#ifndef SOCKET_COMPAT_H
#define SOCKET_COMPAT_H

#ifdef _WIN32
    #ifndef WIN32_LEAN_AND_MEAN
    #define WIN32_LEAN_AND_MEAN
    #endif
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #include <windows.h>
    typedef int socklen_t;
    #define CLOSESOCKET(s) closesocket(s)
    #define INIT_SOCKETS() do { \
        WSADATA wsa; \
        if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) { \
            fprintf(stderr, "[ERROR] WSAStartup failed.\n"); \
            exit(1); \
        } \
    } while(0)
    #define CLEANUP_SOCKETS() WSACleanup()
    #define SLEEP_MS(ms) Sleep(ms)
#else
    #include <sys/types.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    #include <netdb.h>
    typedef int SOCKET;
    #define INVALID_SOCKET (-1)
    #define SOCKET_ERROR (-1)
    #define CLOSESOCKET(s) close(s)
    #define INIT_SOCKETS() do {} while(0)
    #define CLEANUP_SOCKETS() do {} while(0)
    #define SLEEP_MS(ms) usleep((ms) * 1000)
#endif

#endif // SOCKET_COMPAT_H


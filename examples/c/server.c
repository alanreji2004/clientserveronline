#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "socket_compat.h"

#define PORT 5001
#define BUFFER_SIZE 1024

int main(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stderr, NULL, _IONBF, 0);

    INIT_SOCKETS();

    SOCKET server_fd, client_fd;
    struct sockaddr_in address;
    socklen_t addrlen = sizeof(address);
    char buffer[BUFFER_SIZE] = {0};

    printf("[C SERVER] Initializing TCP Server on port %d...\n", PORT);

    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == INVALID_SOCKET) {
        perror("[C SERVER ERROR] Socket creation failed");
        CLEANUP_SOCKETS();
        return 1;
    }

    int opt = 1;
#ifdef _WIN32
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#else
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) == SOCKET_ERROR) {
        perror("[C SERVER ERROR] Bind failed");
        CLOSESOCKET(server_fd);
        CLEANUP_SOCKETS();
        return 1;
    }

    if (listen(server_fd, 3) == SOCKET_ERROR) {
        perror("[C SERVER ERROR] Listen failed");
        CLOSESOCKET(server_fd);
        CLEANUP_SOCKETS();
        return 1;
    }

    printf("[C SERVER] Listening on 127.0.0.1:%d\n", PORT);
    printf("[C SERVER] Ready for connections.\n");

    client_fd = accept(server_fd, (struct sockaddr*)&address, &addrlen);
    if (client_fd == INVALID_SOCKET) {
        perror("[C SERVER ERROR] Accept failed");
        CLOSESOCKET(server_fd);
        CLEANUP_SOCKETS();
        return 1;
    }

    printf("[C SERVER] Client connected successfully!\n");

    int bytes_read;
    while ((bytes_read = recv(client_fd, buffer, BUFFER_SIZE - 1, 0)) > 0) {
        buffer[bytes_read] = '\0';
        printf("[C SERVER RECV] Received: %s\n", buffer);

        char response[BUFFER_SIZE];
        snprintf(response, sizeof(response), "C_SERVER_ACK: Handled -> %s", buffer);
        send(client_fd, response, (int)strlen(response), 0);
        memset(buffer, 0, BUFFER_SIZE);
    }

    printf("[C SERVER] Client disconnected. Cleaning up.\n");
    CLOSESOCKET(client_fd);
    CLOSESOCKET(server_fd);
    CLEANUP_SOCKETS();
    return 0;
}


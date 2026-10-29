#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "socket_compat.h"

#define SERVER_IP "127.0.0.1"
#define PORT 5001
#define BUFFER_SIZE 1024

int main(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stderr, NULL, _IONBF, 0);

    INIT_SOCKETS();

    SOCKET client_fd = INVALID_SOCKET;
    struct sockaddr_in serv_addr;
    char buffer[BUFFER_SIZE] = {0};

    printf("[C CLIENT] Starting socket client...\n");
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(PORT);
    serv_addr.sin_addr.s_addr = inet_addr(SERVER_IP);

    int connected = 0;
    for (int attempt = 1; attempt <= 5; attempt++) {
        client_fd = socket(AF_INET, SOCK_STREAM, 0);
        if (client_fd == INVALID_SOCKET) {
            perror("[C CLIENT ERROR] Socket creation failed");
            CLEANUP_SOCKETS();
            return 1;
        }

        if (connect(client_fd, (struct sockaddr*)&serv_addr, sizeof(serv_addr)) == 0) {
            connected = 1;
            printf("[C CLIENT] Connected to server successfully!\n");
            break;
        }

        printf("[C CLIENT] Attempt %d/5: Server not ready. Retrying in 1s...\n", attempt);
        CLOSESOCKET(client_fd);
        SLEEP_MS(1000);
    }

    if (!connected) {
        fprintf(stderr, "[C CLIENT ERROR] Could not connect to server.\n");
        CLEANUP_SOCKETS();
        return 1;
    }

    const char* messages[] = {
        "Ping from native C client",
        "Concurrent C networking test",
        "Stream verification successful"
    };

    int count = sizeof(messages) / sizeof(messages[0]);
    for (int i = 0; i < count; i++) {
        SLEEP_MS(1000);
        printf("[C CLIENT SEND] %s\n", messages[i]);
        send(client_fd, messages[i], (int)strlen(messages[i]), 0);

        int bytes_read = recv(client_fd, buffer, BUFFER_SIZE - 1, 0);
        if (bytes_read > 0) {
            buffer[bytes_read] = '\0';
            printf("[C CLIENT RECV] %s\n", buffer);
        } else {
            break;
        }
        memset(buffer, 0, BUFFER_SIZE);
    }

    CLOSESOCKET(client_fd);
    CLEANUP_SOCKETS();
    return 0;
}


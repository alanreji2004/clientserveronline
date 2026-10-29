CC ?= gcc
CFLAGS ?= -Wall -Wextra -O0 -g

# OS-specific socket libraries
ifeq ($(OS),Windows_NT)
    LIBS = -lws2_32
    EXT = .exe
else
    LIBS = -pthread
    EXT =
endif

all: server$(EXT) client$(EXT)

server$(EXT): server.c socket_compat.h
	$(CC) $(CFLAGS) server.c -o server$(EXT) $(LIBS)

client$(EXT): client.c socket_compat.h
	$(CC) $(CFLAGS) client.c -o client$(EXT) $(LIBS)

clean:
	rm -f server$(EXT) client$(EXT)


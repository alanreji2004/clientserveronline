import socket

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

msg = input("Enter sentence: ")
s.sendto(msg.encode(), ('localhost', 9002))

data, addr = s.recvfrom(1024)
print("Translated:", data.decode())

s.close()
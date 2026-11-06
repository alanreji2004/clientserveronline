import socket

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(('localhost', 9002))

while True:
    data, addr = s.recvfrom(1024)
    msg = data.decode()

    msg = msg.replace("u", "you")
    msg = msg.replace("ur", "your")
    msg = msg.replace("pls", "please")
    msg = msg.replace("thx", "thanks")
    msg = msg.replace("bcz", "because")
    msg = msg.replace("msg", "message")

    s.sendto(msg.encode(), addr)
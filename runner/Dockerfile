# Production Docker Runner for Online IDE Multi-Process Execution
FROM python:3.12-slim-bookworm

# Install GCC, make, networking tools, and essential build utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    libc6-dev \
    procps \
    net-tools \
    iproute2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged runner user
RUN useradd -m -u 1000 -s /bin/bash coder

# Create workspace directory
WORKDIR /workspace
RUN chown -R coder:coder /workspace

# Switch to unprivileged user
USER coder

# Set Python to unbuffered mode by default
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD gcc --version && python3 --version || exit 1

CMD ["tail", "-f", "/dev/null"]


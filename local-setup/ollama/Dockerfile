# README: 
# - We use stable (GA) release here. 
# - Use 0.17.7-rocm if you deploy on AMD GPUs.
# - The plain tag works for CPU and for NVIDIA GPUs when run with the NVIDIA Container Toolkit.
FROM ollama/ollama:0.17.7

ARG BEATRICE_LLM_MODEL=llama3.2:1b
ENV BEATRICE_LLM_MODEL=${BEATRICE_LLM_MODEL}
# CAUTION: 0.0.0.0 means Ollama will listen on all network interfaces. This allows
# - Internal healthchecks to succeed
# - Our backend service to connect successfully.
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_PORT=11434

# curl for readiness checks during build
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

COPY --chmod=755 prepull-model.sh /usr/local/bin/prepull-model.sh
RUN /usr/local/bin/prepull-model.sh

COPY --chmod=755 healthcheck.sh /usr/local/bin/healthcheck.sh
HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=45s CMD ["/usr/local/bin/healthcheck.sh"]

# IMPORTANT: You need to start the Ollama service at runtime since it is stopped at the end of prepull-model.sh script.
CMD ["serve"]

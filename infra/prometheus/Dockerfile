FROM prom/prometheus:v2.51.0

# Use the production config (scrapes by container name, not host.containers.internal)
COPY prometheus.prod.yml /etc/prometheus/prometheus.yml

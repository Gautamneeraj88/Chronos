#!/usr/bin/env bash
# Creates all required Chronos Kafka topics.
# Run once after the Kafka container is up:
#   bash scripts/setup-kafka-topics.sh
#
# Topics are created with --if-not-exists so the script is safe to re-run.

set -euo pipefail

BROKER="${KAFKA_BROKER:-localhost:9092}"
CONTAINER="${KAFKA_CONTAINER:-chronos-kafka}"
PARTITIONS=6
REPLICATION=1

TOPICS=(
  "chronos.step.execute"
  "chronos.step.result"
  "chronos.step.dlq"
)

echo "Creating Chronos Kafka topics on ${BROKER} ..."

for topic in "${TOPICS[@]}"; do
  podman exec "${CONTAINER}" \
    /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server "${BROKER}" \
    --create \
    --if-not-exists \
    --topic "${topic}" \
    --partitions "${PARTITIONS}" \
    --replication-factor "${REPLICATION}"
  echo "  ✓ ${topic}"
done

echo "Done."

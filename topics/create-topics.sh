#!/usr/bin/env bash
set -e

KAFKA_CL="/usr/bin/docker exec -i $(docker ps --filter ancestor=confluentinc/cp-kafka:7.4.1 -q) /usr/bin/kafka-topics --bootstrap-server localhost:29092"

# if above doesn't work, run manually using kafka CLI inside container

# create file-chunks (binary payload), partitions tunable
docker exec -it $(docker ps --filter ancestor=confluentinc/cp-kafka:7.4.1 -q) kafka-topics --bootstrap-server localhost:29092 --create --topic file-chunks --partitions 6 --replication-factor 1

# file-events
docker exec -it $(docker ps --filter ancestor=confluentinc/cp-kafka:7.4.1 -q) kafka-topics --bootstrap-server localhost:29092 --create --topic file-events --partitions 3 --replication-factor 1

# file-manifest (compacted)
docker exec -it $(docker ps --filter ancestor=confluentinc/cp-kafka:7.4.1 -q) kafka-topics --bootstrap-server localhost:29092 --create --topic file-manifest --partitions 6 --replication-factor 1 --config cleanup.policy=compact

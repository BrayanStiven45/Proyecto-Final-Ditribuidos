#!/bin/bash

echo "Esperando a que Kafka inicie..."
sleep 15

echo "Creando topic 'file-chunks'..."
/opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka-1:9092 \
  --create \
  --if-not-exists \
  --topic file-chunks \
  --partitions 2 \
  --replication-factor 1

echo "Topic creado correctamente"

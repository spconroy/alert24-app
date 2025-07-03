#!/bin/sh
# lib/backup.sh
# Usage: sh lib/backup.sh [backup-file.sql]
# Backs up the alert24 PostgreSQL database (alert24_schema)

: "${PGHOST:=34.223.13.196}"
: "${PGUSER:=alert24}"
: "${PGDATABASE:=alert24}"
: "${PGPORT:=5432}"
: "${PGPASSWORD:=Sg47^kLm9@wPz!rT}"

export PGPASSWORD

BACKUP_FILE=${1:-"alert24_backup_$(date +%Y%m%d_%H%M%S).sql"}

pg_dump --host=$PGHOST --port=$PGPORT --username=$PGUSER --dbname=$PGDATABASE --schema=alert24_schema --no-owner --no-privileges --format=plain --file="$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Backup successful: $BACKUP_FILE"
else
  echo "Backup failed"
  exit 1
fi 
#!/usr/bin/env bash
# Compat: delega ao backup com retenção (inclui espelho Atlas).
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vps-mongo-backup-retention.sh"

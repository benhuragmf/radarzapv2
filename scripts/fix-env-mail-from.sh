#!/usr/bin/env bash
# Corrige MAIL_FROM sem aspas no .env gerado pelo bootstrap antigo.
set -euo pipefail
ENV_FILE="${1:-.env}"
python3 - "$ENV_FILE" <<'PY'
import re, sys
p = sys.argv[1]
t = open(p, encoding="utf-8").read()
t = re.sub(r"^MAIL_FROM=.*", 'MAIL_FROM="RadarZap <noreply@radarzap.local>"', t, flags=re.M)
open(p, "w", encoding="utf-8").write(t)
print(f"[fix-env] MAIL_FROM corrigido em {p}")
PY

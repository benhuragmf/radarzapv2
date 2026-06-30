#!/usr/bin/env bash
# Atualiza ou insere uma chave em arquivo .env (uso: KEY=valor bash scripts/vps-patch-env-key.sh /path/.env KEY valor)
set -euo pipefail

ENV_FILE="${1:?env file}"
KEY="${2:?key}"
VALUE="${3:?value}"

python3 - "$ENV_FILE" "$KEY" "$VALUE" <<'PY'
import re, sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    text = open(path, encoding="utf-8").read()
except FileNotFoundError:
    text = ""
line = f"{key}={value}"
if re.search(rf"^{re.escape(key)}=", text, flags=re.M):
    text = re.sub(rf"^{re.escape(key)}=.*", line, text, flags=re.M)
else:
    if text and not text.endswith("\n"):
        text += "\n"
    text += line + "\n"
open(path, "w", encoding="utf-8").write(text)
print(f"[patch-env] {key} -> {path}")
PY

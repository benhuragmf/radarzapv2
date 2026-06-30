#!/usr/bin/env bash
# Completa .env de produção (secrets gerados + URL HTTPS app.radarchat.com.br).
set -euo pipefail
ENV_FILE="${1:-.env}"
PUBLIC_HOST="${PUBLIC_HOST:-app.radarchat.com.br}"
PUBLIC_URL="https://${PUBLIC_HOST}"
OTP="$(openssl rand -hex 32)"
python3 - "$ENV_FILE" "$PUBLIC_URL" "$OTP" <<'PY'
import re, sys
p, url, otp = sys.argv[1], sys.argv[2], sys.argv[3]
t = open(p, encoding="utf-8").read()
def setkv(key, val):
    global t
    line = f"{key}={val}"
    if re.search(rf"^{re.escape(key)}=", t, flags=re.M):
        t = re.sub(rf"^{re.escape(key)}=.*", line, t, flags=re.M)
    else:
        t += "\n" + line + "\n"
setkv("FRONTEND_URL", url)
setkv("CORS_ORIGIN", url)
setkv("COOKIE_SECURE", "true")
if not re.search(r"^TICKET_OTP_PEPPER=.+", t, flags=re.M):
    setkv("TICKET_OTP_PEPPER", otp)
t = re.sub(r"^MAIL_FROM=.*", 'MAIL_FROM="Radar Chat <noreply@radarchat.local>"', t, flags=re.M)
open(p, "w", encoding="utf-8").write(t)
print(f"[env-patch] FRONTEND_URL/CORS={url} COOKIE_SECURE=true TICKET_OTP_PEPPER ok")
PY
echo "[env-patch] Falta preencher: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET (e OAuth Google se usar Gmail)"

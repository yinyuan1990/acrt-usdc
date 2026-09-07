#!/usr/bin/env bash
# Run AFTER the DNS A records (apex + www) point at this server.
#   node ops/ssh.mjs --script ops/enable-tls.sh
# Certbot edits /etc/nginx/conf.d/arclaunch.conf in place (adds the 443 block + 80→443 redirect).
set -e
DOMAIN=${DOMAIN:-arclaunch.top}
IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
NS=$(dig +short NS "$DOMAIN" | head -1)
for h in "$DOMAIN" "www.$DOMAIN"; do
  RESOLVED=$(dig +short A "$h" @"${NS:-8.8.8.8}" | grep -E '^[0-9.]+$' | head -1)
  echo "$h resolves to: ${RESOLVED:-<none>} (server $IP)"
  if [ "$RESOLVED" != "$IP" ]; then echo "DNS not pointing here yet; fix the A record and retry."; exit 1; fi
done
# /root/.local has a newer urllib3 that breaks the distro certbot; ignore user-site packages.
export PYTHONNOUSERSITE=1
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
nginx -t && systemctl reload nginx
echo "https apex http_code=$(curl -s -o /dev/null -w '%{http_code}' https://$DOMAIN/)"
echo "https www  http_code=$(curl -s -o /dev/null -w '%{http_code}' https://www.$DOMAIN/)"
certbot certificates 2>/dev/null | grep -A3 "$DOMAIN" | head -4
echo TLS_OK

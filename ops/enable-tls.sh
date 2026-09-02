#!/usr/bin/env bash
# Run AFTER the DNS A record launch.hzmrbq.com -> 45.205.18.104 exists.
#   node ops/ssh.mjs --script ops/enable-tls.sh
set -e
DOMAIN=${DOMAIN:-launch.hzmrbq.com}
IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1)
echo "server ip: $IP · $DOMAIN resolves to: ${RESOLVED:-<none>}"
if [ "$RESOLVED" != "$IP" ]; then
  echo "DNS not pointing here yet; add A record and retry."; exit 1
fi
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
nginx -t && systemctl reload nginx
echo "https http_code=$(curl -s -o /dev/null -w '%{http_code}' https://$DOMAIN/)"
certbot certificates 2>/dev/null | grep -A2 "$DOMAIN" | head -3
echo TLS_OK

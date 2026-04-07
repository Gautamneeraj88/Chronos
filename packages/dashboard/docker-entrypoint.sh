#!/bin/sh
set -e
# Read the nameserver from the container's /etc/resolv.conf so the nginx
# resolver directive works on both Docker (127.0.0.11) and Podman (varies).
RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
sed -i "s/__RESOLVER__/$RESOLVER/" /etc/nginx/conf.d/default.conf
exec "$@"

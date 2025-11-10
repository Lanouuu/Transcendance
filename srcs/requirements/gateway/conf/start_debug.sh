#!/bin/sh

# Hot-reload pour le typescript
cd /etc/nginx/html && npx tsc --watch &

# Hot-reload pour le css (tailwind)
cd /etc/nginx/html && npx tailwindcss -i ./css/style.css -o ./css/output.css --watch &


nginx -g 'daemon off;'


# SEULEMENT POUR LE DEV --> A SUPPRIMER
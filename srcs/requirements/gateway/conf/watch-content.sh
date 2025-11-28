#!/bin/sh

cd /etc/nginx/html

inotifywait -m -q -r -e modify,create,delete \
  ./pages \
  ./scripts \
  ./index.html  \
  --exclude '\.git|node_modules|\.swp' 2>/dev/null | while read path action file; do
  echo "🔄 $file changed at $(date +%T), recompiling..."
  tailwindcss -i ./css/style.css -o ./css/output.css --config ./tailwind.config.js --minify
  echo "✅ Done"
done
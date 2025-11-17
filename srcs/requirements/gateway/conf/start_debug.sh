#!/bin/sh

# Désactive le warning Browserslist
export BROWSERSLIST_IGNORE_OLD_DATA=1

echo "🔧 Starting development environment..."
echo ""

# 1. TypeScript watch
echo "📘 Starting TypeScript watch..."
cd /etc/nginx/html && tsc --watch > /tmp/tsc.log 2>&1 &
TSC_PID=$!
echo "   ✓ TypeScript watcher started (PID: $TSC_PID)"

# 2. Première compilation Tailwind
echo ""
echo "🎨 Compiling Tailwind CSS (initial build)..."
cd /etc/nginx/html && tailwindcss -i ./css/style.css -o ./css/output.css --minify

if [ -f /etc/nginx/html/css/output.css ]; then
    SIZE=$(du -h /etc/nginx/html/css/output.css | cut -f1)
    echo "   ✓ output.css generated ($SIZE)"
else
    echo "   ❌ ERROR: output.css not generated!"
    exit 1
fi

# 3. Nodemon pour style.css
echo ""
echo "👀 Starting nodemon for style.css..."
nodemon \
    --watch /etc/nginx/html/css/style.css \
    --exec "echo '🔄 style.css changed' && cd /etc/nginx/html && tailwindcss -i ./css/style.css -o ./css/output.css --minify && echo '✅ CSS recompiled'" \
    > /tmp/nodemon.log 2>&1 &
NODEMON_PID=$!
echo "   ✓ Nodemon started (PID: $NODEMON_PID)"

# 4. inotifywait pour surveiller les HTML/JS/TS
echo ""
echo "👀 Starting inotifywait for content files..."
/etc/nginx/html/conf/watch-content.sh > /tmp/inotify.log 2>&1 &
INOTIFY_PID=$!
echo "   ✓ inotifywait started (PID: $INOTIFY_PID)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🔄 Active watchers:"
echo "   - TypeScript (PID: $TSC_PID)"
echo "   - Nodemon (PID: $NODEMON_PID)"
echo "   - inotifywait (PID: $INOTIFY_PID)"
echo ""
echo "📝 Log files:"
echo "   - TypeScript:      /tmp/tsc.log"
echo "   - Nodemon:         /tmp/nodemon.log"
echo "   - inotifywait:     /tmp/inotify.log"
echo ""
echo "🔍 Monitor in real-time:"
echo "   docker exec gateway tail -f /tmp/inotify.log"
echo "   docker exec gateway tail -f /tmp/nodemon.log"
echo ""
echo "🚀 Starting nginx..."
nginx -g 'daemon off;'
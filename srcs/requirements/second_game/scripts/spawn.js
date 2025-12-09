export function generateRandomSpawn(gridWidth, gridHeight, otherSnake) {
    const initialLength = 3;
    const minDistance = 10; // Minimum cells away from other snake
    const borderMargin = 5; // Stay away from borders

    let attempts = 0;
    let validSpawn = false;
    let spawn = [];
    let direction = {x: 0, y: 0};

    while (!validSpawn && attempts < 100) {
        // Random starting position (with border margin)
        const x = Math.floor(Math.random() * (gridWidth - 2 * borderMargin)) + borderMargin;
        const y = Math.floor(Math.random() * (gridHeight - 2 * borderMargin)) + borderMargin;

        // Random initial direction (0: right, 1: down, 2: left, 3: up)
        const dirIndex = Math.floor(Math.random() * 4);
        const directions = [
            {x: 1, y: 0},   // right
            {x: 0, y: 1},   // down
            {x: -1, y: 0},  // left
            {x: 0, y: -1}   // up
        ];
        direction = directions[dirIndex];

        // Create snake segments (head first)
        spawn = [];
        for (let i = 0; i < initialLength; i++) {
            spawn.push({
                x: x - (direction.x * i),
                y: y - (direction.y * i)
            });
        }

        // Check if all segments are within grid
        const allInGrid = spawn.every(segment =>
            segment.x >= 0 && segment.x < gridWidth &&
            segment.y >= 0 && segment.y < gridHeight
        );

        if (!allInGrid) {
            attempts++;
            continue;
        }

        // Check if spawn is far enough from other snake
        if (otherSnake && otherSnake.length > 0) {
            const tooClose = spawn.some(segment =>
                otherSnake.some(otherSegment => {
                    const manhattanDistance =
                        Math.abs(segment.x - otherSegment.x) +
                        Math.abs(segment.y - otherSegment.y);
                    return manhattanDistance < minDistance;
                })
            );
            validSpawn = !tooClose;
        } else {
            validSpawn = true;
        }

        attempts++;
    }

    // Fallback if no valid spawn found after 100 attempts
    if (!validSpawn) {
        console.warn("Could not find optimal spawn position, using fallback");
        const fallbackX = Math.floor(gridWidth / 4) + (otherSnake ? Math.floor(gridWidth / 2) : 0);
        const fallbackY = Math.floor(gridHeight / 2);
        direction = {x: 1, y: 0};
        spawn = [];
        for (let i = 0; i < initialLength; i++) {
            spawn.push({
                x: fallbackX - i,
                y: fallbackY
            });
        }
    }

    return {
        snake: spawn,
        direction: direction
    };
}

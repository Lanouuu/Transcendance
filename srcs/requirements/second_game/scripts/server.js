import Fastify from "fastify";
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { SnakeGame } from './gameClass.js';
import { checkCollisions, determineWinner } from './collision.js';
import { generateRandomSpawn } from './spawn.js';
import fs from 'fs';

export function runServer() {

    const fastify = Fastify({
        logger: true,
        connectionTimeout: 120000,
        keepAliveTimeout: 120000,
        https: {
            key: fs.readFileSync('/etc/ssl/transcendence.key'),
            cert: fs.readFileSync('/etc/ssl/transcendence.crt') 
        }
    });
    const PORT = parseInt(process.env.SECOND_GAME_PORT, 10);
    const HOST = process.env.SECOND_GAME_HOST;

    // Register CORS
    fastify.register(cors, {
        origin: true,
        credentials: true
    });

    // Game state management
    const games = new Map();
    let gameId = 0;
    let pendingRemoteGame = [];

    // Utility functions
    function isValidDirection(direction) {
        if (!direction || typeof direction !== 'object') return false;
        if (typeof direction.x !== 'number' || typeof direction.y !== 'number') return false;

        // Only allow cardinal directions: {x: -1, 0, 1} and {y: -1, 0, 1}
        const validValues = [-1, 0, 1];
        if (!validValues.includes(direction.x) || !validValues.includes(direction.y)) return false;

        // Must be exactly one axis at a time (not diagonal, not stationary)
        if (Math.abs(direction.x) + Math.abs(direction.y) !== 1) return false;

        return true;
    }

    async function getUserName(userId) {
        try {
            const response = await fetch(`http://users:3000/users/${userId}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            if (response.ok) {
                const data = await response.json();
                return data.username || `Player ${userId}`;
            }
        } catch (e) {
            console.error("Error fetching username:", e.message);
        }
        return `Player ${userId}`;
    }

    // Serialize game state for JSON transmission (exclude non-serializable objects)
    function serializeGameState(game) {
        return {
            id: game.id,
            mode: game.mode,
            message: game.message,
            winner: game.winner,
            displayWinner: game.displayWinner,
            started: game.started,
            timer: game.timer,
            timerStarted: game.timerStarted,
            tickCount: game.tickCount,
            grid: game.grid,
            player1: {
                name: game.player1.name,
                id: game.player1.id,
                snake: game.player1.snake,
                direction: game.player1.direction,
                nextDirection: game.player1.nextDirection,
                alive: game.player1.alive,
                color: game.player1.color
            },
            player2: {
                name: game.player2.name,
                id: game.player2.id,
                snake: game.player2.snake,
                direction: game.player2.direction,
                nextDirection: game.player2.nextDirection,
                alive: game.player2.alive,
                color: game.player2.color
            }
        };
    }

    async function sendResult(game) {
        try {
            let winnerID = null;
            if (game.winner === "Player1") {
                winnerID = game.player1.id;
            } else if (game.winner === "Player2") {
                winnerID = game.player2.id;
            }

            const matchData = {
                player1ID: game.player1.id,
                player2ID: game.player2.id,
                winnerID: winnerID,
                scoreP1: game.player1.snake.length,
                scoreP2: game.player2.snake.length,
                matchType: "snake_remote"
            };

            const response = await fetch("http://users:3000/save-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(matchData)
            });

            if (!response.ok) {
                console.error("Failed to save match result");
            }
        } catch (e) {
            console.error("Error sending result:", e.message);
        }
    }

    function startTimer(game) {
        const timerInterval = setInterval(() => {
            if (game.timer > 0) {
                game.message = "Countdown";
                game.timer--;

                // Broadcast timer update
                game.socket.forEach(socket => {
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify(serializeGameState(game)));
                    }
                });
            } else {
                game.message = "Playing";
                game.started = true;
                clearInterval(timerInterval);

                // Broadcast game start
                game.socket.forEach(socket => {
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify(serializeGameState(game)));
                    }
                });
            }
        }, 1000);
    }

    function updateSnakeDirection(player) {
        if (!player.snake || player.snake.length === 0) return;

        const head = player.snake[0];
        const neck = player.snake[1];

        // Only update if nextDirection is set
        if (player.nextDirection.x !== 0 || player.nextDirection.y !== 0) {
            // Check if nextDirection would cause a reverse
            const wouldReverse = neck &&
                (head.x + player.nextDirection.x === neck.x) &&
                (head.y + player.nextDirection.y === neck.y);

            if (!wouldReverse) {
                player.direction = {...player.nextDirection};
            }
        }
    }

    function moveSnake(player) {
        if (!player.snake || player.snake.length === 0) return;

        const head = player.snake[0];
        const newHead = {
            x: head.x + player.direction.x,
            y: head.y + player.direction.y
        };

        // Add new head at front (snake grows automatically)
        player.snake.unshift(newHead);
    }

    function snakeGameLoop(game) {
        if (!game.socket || game.socket.length === 0) {
            clearInterval(game.loopId);
            return;
        }

        // Handle countdown timer
        if (game.timerStarted === false) {
            game.timerStarted = true;
            startTimer(game);
        }

        if (game.started === true) {
            game.tickCount++;

            // 1. Update directions (with anti-reverse validation)
            if (game.player1.alive) {
                updateSnakeDirection(game.player1);
            }
            if (game.player2.alive) {
                updateSnakeDirection(game.player2);
            }

            // 2. Move snakes (add new head)
            if (game.player1.alive) {
                moveSnake(game.player1);
            }
            if (game.player2.alive) {
                moveSnake(game.player2);
            }

            // 3. Check collisions
            checkCollisions(game);

            // 4. Determine winner if necessary
            if (!game.player1.alive || !game.player2.alive) {
                determineWinner(game);
                game.message = "END";

                if (game.mode === "remote") {
                    sendResult(game);
                }

                clearInterval(game.loopId);
            } else {
                game.message = "Playing";
            }

            // 5. Broadcast state to all clients
            game.socket.forEach(socket => {
                if (socket.readyState === 1) {
                    socket.send(JSON.stringify(serializeGameState(game)));
                }
            });
        }
    }

    // HTTP Routes

    // Local game route
    fastify.get("/local", async (request, reply) => {
        try {
            const game = new SnakeGame({
                id: gameId++,
                socket: [],
                mode: 'local',
                message: 'start'
            });

            // Initialize both snakes with random positions
            const spawn1 = generateRandomSpawn(game.grid.width, game.grid.height, null);
            game.player1.snake = spawn1.snake;
            game.player1.direction = spawn1.direction;
            game.player1.nextDirection = spawn1.direction;
            game.player1.name = "Player 1";

            const spawn2 = generateRandomSpawn(game.grid.width, game.grid.height, game.player1.snake);
            game.player2.snake = spawn2.snake;
            game.player2.direction = spawn2.direction;
            game.player2.nextDirection = spawn2.direction;
            game.player2.name = "Player 2";

            games.set(game.id, game);
            reply.send(game);
        } catch (e) {
            console.error(e.message);
            reply.send([]);
        }
    });

    // Remote game route
    fastify.get("/remote", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];

            if (!userId) {
                return reply.status(401).send({ error: "User ID required" });
            }

            const userName = await getUserName(userId);

            // Check if there's a pending game BEFORE adding to queue (prevent race condition)
            if (pendingRemoteGame.length === 0) {
                // First player: create waiting game
                const game = new SnakeGame({
                    id: gameId++,
                    socket: [],
                    mode: 'remote',
                    message: "Waiting"
                });

                // Initialize Player 1
                const spawn1 = generateRandomSpawn(game.grid.width, game.grid.height, null);
                game.player1.snake = spawn1.snake;
                game.player1.direction = spawn1.direction;
                game.player1.nextDirection = spawn1.direction;
                game.player1.id = userId;
                game.player1.name = userName;

                pendingRemoteGame.push(game);
                games.set(game.id, game);
                reply.send(game);
            } else {
                // Second player: join and start
                const gameTemp = pendingRemoteGame.shift();
                const game = games.get(gameTemp.id);

                // Verify game still exists
                if (!game) {
                    return reply.status(404).send({ error: "Game no longer available" });
                }

                // Initialize Player 2
                const spawn2 = generateRandomSpawn(game.grid.width, game.grid.height, game.player1.snake);
                game.player2.snake = spawn2.snake;
                game.player2.direction = spawn2.direction;
                game.player2.nextDirection = spawn2.direction;
                game.player2.id = userId;
                game.player2.name = userName;

                game.message = "start";
                games.set(game.id, game);
                reply.send(game);

                // Notify first player
                game.socket.forEach(socket => {
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify(serializeGameState(game)));
                    }
                });
            }
        } catch (e) {
            console.error(e.message);
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    // State query route
    fastify.get("/state/:id", async (request, reply) => {
        try {
            const id = parseInt(request.params.id, 10);
            if (!games.has(id)) {
                return reply.status(404).send({ error: "Game not found" });
            }
            const game = games.get(id);
            reply.send(game);
        } catch(e) {
            reply.status(404).send({ error: e.message });
        }
    });

    // WebSocket Handler
    const wss = new WebSocketServer({
        server: fastify.server,
        path: '/ws'
    });

    wss.on('connection', function connection(ws) {
        ws.on('error', function(error) {
            console.error('WebSocket error:', {
                message: error.message,
                code: error.code,
                userId: ws.userId || 'unknown'
            });
        });

        ws.on('message', function message(data) {
            try {
                const res = JSON.parse(data.toString());

                if (!res.game || !res.game.id) {
                    ws.send(JSON.stringify({ message: "Error", error: "Invalid game data" }));
                    return;
                }

                const gameId = parseInt(res.game.id, 10);
                if (!games.has(gameId)) {
                    ws.send(JSON.stringify({ message: "Error", error: "Game not found" }));
                    return;
                }

                let game = games.get(gameId);

                if (res.message === "Init") {
                    // Pair WebSocket with player for remote games
                    if (game.mode === "remote") {
                        if (ws.userId === undefined && game.socket.length === 0) {
                            ws.userId = game.player1.id;
                        } else if (ws.userId === undefined && game.socket.length === 1) {
                            ws.userId = game.player2.id;
                        }
                    }

                    game.socket.push(ws);
                    games.set(game.id, game);

                    // Start game loop on first connection (300ms tick)
                    if (game.message === "start" && !game.loopId) {
                        game.loopId = setInterval(() => snakeGameLoop(game), 300);
                    }

                    // Send initial state
                    ws.send(JSON.stringify(serializeGameState(game)));

                } else if (res.message === "input") {
                    // Handle direction changes
                    if (game.mode === "remote") {
                        // Remote mode: only accept inputs from paired player
                        if (ws.userId === game.player1.id && res.game.player1.nextDirection) {
                            if (isValidDirection(res.game.player1.nextDirection)) {
                                game.player1.nextDirection = res.game.player1.nextDirection;
                            } else {
                                ws.send(JSON.stringify({ message: "Error", error: "Invalid direction" }));
                            }
                        } else if (ws.userId === game.player2.id && res.game.player2.nextDirection) {
                            if (isValidDirection(res.game.player2.nextDirection)) {
                                game.player2.nextDirection = res.game.player2.nextDirection;
                            } else {
                                ws.send(JSON.stringify({ message: "Error", error: "Invalid direction" }));
                            }
                        }
                    } else {
                        // Local mode: both players from same client
                        if (res.game.player1.nextDirection) {
                            if (isValidDirection(res.game.player1.nextDirection)) {
                                game.player1.nextDirection = res.game.player1.nextDirection;
                            }
                        }
                        if (res.game.player2.nextDirection) {
                            if (isValidDirection(res.game.player2.nextDirection)) {
                                game.player2.nextDirection = res.game.player2.nextDirection;
                            }
                        }
                    }

                    games.set(game.id, game);
                }
            } catch (e) {
                console.error("WebSocket message error:", e.message);
                ws.send(JSON.stringify({ message: "Error", error: e.message }));
            }
        });

        ws.on('close', function close() {
            console.log("WebSocket connection closed");

            // Cleanup: find and remove this WebSocket from all games
            games.forEach((game, gameId) => {
                const socketIndex = game.socket.indexOf(ws);
                if (socketIndex !== -1) {
                    game.socket.splice(socketIndex, 1);

                    // If no more sockets connected, clean up the game
                    if (game.socket.length === 0) {
                        if (game.loopId) {
                            clearInterval(game.loopId);
                        }
                        games.delete(gameId);

                        // Remove from pending queue if present
                        const pendingIndex = pendingRemoteGame.findIndex(g => g.id === gameId);
                        if (pendingIndex !== -1) {
                            pendingRemoteGame.splice(pendingIndex, 1);
                        }

                        console.log(`Game ${gameId} cleaned up`);
                    }
                }
            });
        });
    });

    // Start server
    fastify.listen({host: HOST, port: PORT}, (err) => {
        if (err) {
            fastify.log.error(err);
            process.exit(1);
        }
        console.log(`Snake game server running on ${HOST}:${PORT}`);
    });
}

runServer();

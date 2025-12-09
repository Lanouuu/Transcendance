export class SnakeGame {
    constructor({id, socket, mode, message}) {
        this.id = id
        this.socket = socket  // Array de WebSocket connections
        this.mode = mode      // "local" ou "remote"
        this.message = message // "Waiting", "start", "Countdown", "Playing", "END"

        // Grid configuration
        this.grid = {
            width: 30,
            height: 30,
            cellSize: 20  // Pixels per cell (for frontend rendering)
        }

        // Player 1 Snake
        this.player1 = {
            name: undefined,
            id: undefined,
            snake: [],                    // Array of {x, y} positions (head at index 0)
            direction: {x: 0, y: 0},     // Current direction vector
            nextDirection: {x: 0, y: 0}, // Buffered next direction (prevents instant reverse)
            alive: true,
            color: "#00FF00"             // Green snake
        }

        // Player 2 Snake
        this.player2 = {
            name: undefined,
            id: undefined,
            snake: [],                    // Array of {x, y} positions
            direction: {x: 0, y: 0},
            nextDirection: {x: 0, y: 0},
            alive: true,
            color: "#FF0000"             // Red snake
        }

        // Game lifecycle
        this.winner = ""
        this.displayWinner = ""
        this.started = false
        this.timer = 3
        this.timerStarted = false
        this.loopId = null
        this.tickCount = 0
    }
}

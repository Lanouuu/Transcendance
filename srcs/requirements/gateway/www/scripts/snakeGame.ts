export interface GridPosition {
    x: number;
    y: number;
}

export interface Direction {
    x: number;
    y: number;
}

export interface Grid {
    width: number;
    height: number;
    cellSize: number;
}

export class SnakePlayer {
    name: string | undefined;
    id: number | undefined;
    snake: GridPosition[];
    direction: Direction;
    nextDirection: Direction;
    alive: boolean;
    color: string;

    constructor(data: any) {
        this.name = data.name;
        this.id = data.id;
        this.snake = data.snake || [];
        this.direction = data.direction || {x: 0, y: 0};
        this.nextDirection = data.nextDirection || {x: 0, y: 0};
        this.alive = data.alive !== undefined ? data.alive : true;
        this.color = data.color || "#00FF00";
    }
}

export class SnakeGame {
    id: number;
    socket: WebSocket | undefined;
    mode: string;
    message: string;
    winner: string;
    displayWinner: string;
    started: boolean;
    timer: number;
    timerStarted: boolean;
    tickCount: number;

    grid: Grid;

    player1: SnakePlayer;
    player2: SnakePlayer;

    constructor(data: any) {
        this.id = data.id;
        this.socket = undefined;
        this.mode = data.mode;
        this.message = data.message;
        this.winner = data.winner || "";
        this.displayWinner = data.displayWinner || "";
        this.started = data.started || false;
        this.timer = data.timer || 3;
        this.timerStarted = data.timerStarted || false;
        this.tickCount = data.tickCount || 0;

        this.grid = data.grid || {width: 30, height: 30, cellSize: 20};

        this.player1 = new SnakePlayer(data.player1 || {});
        this.player2 = new SnakePlayer(data.player2 || {});
    }

    updateFromServer(serverData: any) {
        this.message = serverData.message;
        this.started = serverData.started;
        this.timer = serverData.timer;
        this.winner = serverData.winner;
        this.displayWinner = serverData.displayWinner;
        this.tickCount = serverData.tickCount;

        if (serverData.player1) {
            this.player1.snake = serverData.player1.snake;
            this.player1.alive = serverData.player1.alive;
            this.player1.direction = serverData.player1.direction;
            this.player1.name = serverData.player1.name;
        }

        if (serverData.player2) {
            this.player2.snake = serverData.player2.snake;
            this.player2.alive = serverData.player2.alive;
            this.player2.direction = serverData.player2.direction;
            this.player2.name = serverData.player2.name;
        }
    }
}

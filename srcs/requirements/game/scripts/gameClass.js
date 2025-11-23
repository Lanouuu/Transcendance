export class Game {
    constructor({id, socket, mode}) {
        this.id = id
        this.socket = socket
        this.mode = mode
        this.message = ""
        this.winner = ""
        this.displayWinner = ""
        this.started = false
        this.timer = 3
        this.timerStarted = false

        // Player objects with placeholder sprite shapes so client can safely set sprite later
        this.player1 = {
            name: undefined,
            key: { up: false, down: false },
            score: 0,
            sprite: undefined
        }

        this.player2 = {
            name: undefined,
            key: { up: false, down: false },
            score: 0,
            sprite: undefined
        }

        this.ball = undefined
        this.board = undefined
    }
}
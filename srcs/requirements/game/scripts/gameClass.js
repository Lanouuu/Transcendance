export class Game {
    constructor({id, socket, mode, message}) {
        this.id = id
        this.socket = socket
        this.mode = mode
        this.message = message
        this.winner = ""
        this.displayWinner = ""
        this.started = false
        this.timer = 3
        this.timerStarted = false
        this.nbPlayer = 0

        this.player1 = {
            name: undefined,
            key: { up: false, down: false },
            score: 0,
            sprite: {
                position: {
                    x: undefined,
                    y: undefined
                },
                imgSize: {
                    height: undefined,
                    width: undefined
                },
                loaded: undefined
            },
            id: undefined
        }

        this.player2 = {
            name: undefined,
            key: { up: false, down: false },
            score: 0,
            sprite: {
                position: {
                    x: undefined,
                    y: undefined
                },
                imgSize: {
                    height: undefined,
                    width: undefined
                },
                loaded: undefined
            },
            id: undefined
        }

        this.ball = {
            position: {
                x: undefined,
                y: undefined
            },
            imgSize: {
                height: undefined,
                width: undefined
            },
            velocity: {
                x: -9,
                y: 9
            },
            loaded: undefined
        }

        this.board = {
            position: {
                x: undefined,
                y: undefined
            },
            imgSize: {
                height: undefined,
                width: undefined
            },
            loaded: undefined
        }
    }
}
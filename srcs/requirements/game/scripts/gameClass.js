export class Game {
    constructor({id, socket, mode, player1, player2, ball, board}) {
        this.id = id
        this.socket = socket
        this.mode = mode
        this.player1 = player1
        this.player2 = player2
        this.ball = ball
        this.board = board
    }
}
import { Sprite } from './spriteClass.js'

async function loadImage(imagePath, velocity, key, score) {
    return new Promise((resolve, reject) => {
        const img = new Sprite({
            image: imagePath,
            velocity: velocity,
            key: key,
            score: score
        })
        img.image.onload = () => resolve(img)
        img.image.onerror = () => reject(new Error(`Error, image ${imagePath} couldn't be load`))
    })
}

function initSprite(board, player1, player2, ball) {
        board.loaded = true
        player1.loaded = true
        player2.loaded = true
        ball.loaded = true
        
        board.position = {
            x: 0,
            y: 0
        }
        board.height = board.image.height
        board.width = board.image.width

        player1.position = {
            x: 0,
            y: board.image.height / 2 - player1.image.height / 2
        }
        player1.height = player1.image.height
        player1.width = player1.image.width

        player2.position = {
            x: board.image.width - player2.image.width,
            y: board.image.height / 2 - player2.image.height / 2
        }
        player2.height = player2.image.height
        player2.width = player2.image.width
        
        ball.position = {
            x: board.image.width / 2 - ball.image.width / 2,
            y: board.image.height / 2 - ball.image.height / 2
        }
        ball.height = ball.image.height
        ball.width = ball.image.width
}

export async function loadSprites(game) {
    try {
        const [board, player1, player2, ball] = await Promise.all([
            loadImage('../assets/pong/Board.png', {x:0, y:0}, {up: undefined, down: undefined}, undefined),
            loadImage('../assets/pong/Player.png', {x:0, y:0}, {up: false, down: false}, 0),
            loadImage('../assets/pong/Player2.png', {x:0, y:0}, {up: false, down: false}, 0),
            loadImage('../assets/pong/Ball.png', {x:9, y:9}, {up: undefined, down: undefined}, undefined)]
        )
        initSprite(board, player1, player2, ball)
        game.board = board
        game.player1 = player1
        game.player2 = player2
        game.ball = ball
        // return [board, player, player2, ball]
    }catch(e) {
        console.log("ERREUR CHARGEMENT IMAGES")
        console.log(e.message)
        return []
    }
}
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

export async function loadSprites() {
    try {
        const [board, player, player2, ball] = await Promise.all([
            loadImage('../assets/Board.png', {x:0, y:0}, {up: undefined, down: undefined}, undefined),
            loadImage('../assets/Player.png', {x:0, y:0}, {up: false, down: false}, 0),
            loadImage('../assets/Player2.png', {x:0, y:0}, {up: false, down: false}, 0),
            loadImage('../assets/Ball.png', {x:9, y:9}, {up: undefined, down: undefined}, undefined)])

        board.loaded = true
        player.loaded = true
        player2.loaded = true
        ball.loaded = true
        board.position = {
            x: 0,
            y: 0
        }
        player.position = {
            x: 0,
            y: board.image.height / 2 - player.image.height / 2
        }
        
        player2.position = {
            x: board.image.width - player2.image.width,
            y: board.image.height / 2 - player.image.height / 2
        }
        
        ball.position = {
            x: board.image.width / 2 - ball.image.width / 2,
            y: board.image.height / 2 - ball.image.height / 2
        }
        return [board, player, player2, ball]
    }catch(e) {
        console.log(e.message)
        return []
    }
}
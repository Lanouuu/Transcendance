// const board = new Sprite({
//     position: {
//         x: 0,
//         y: 0
//     },
//     image: '../assets/Board.png'
// })

// const player = new Sprite({
//     image: '../assets/Player.png',
//     key: {
//         up: false,
//         down: false
//     },
//     score: 0
// })

// const player2 = new Sprite({
//     image: '../assets/Player2.png',
//     key: {
//         up: false,
//         down: false
//     },
//     score: 0
// })

// const ball = new Sprite({
//     velocity: {
//         x: 9,
//         y: 9
//     },
//     image: '../assets/Ball.png' 
// })


async function loadImage(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Sprite()
        img.image.src = imagePath
        img.image.onload = () => resolve(img)
        img.image.onerror = () => reject(new Error(`Error, image ${imagePath} couldn't be load`))
    })
}

export async function loadSprites() {
    try {
        const [board, player, player2, ball] = await Promise.all([
            loadImage('../assets/Board.png'),
            loadImage('../assets/Player.png'),
            loadImage('../assets/Player2.png'),
            loadImage('../assets/Ball.png')])

        board.loaded = true
        player.loaded = true
        player2.loaded = true
        ball.loaded = true
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
    }
}
const canvas = document.getElementById("canvas")
const canvasContext = canvas.getContext('2d')

const board = new Sprite({
    position: {
        x: 0,
        y: 0
    },
    image: '../assets/Board.png'
})

const player = new Sprite({
    image: '../assets/Player.png',
    key: {
        up: false,
        down: false
    }
})

const player2 = new Sprite({
    image: '../assets/Player2.png',
    key: {
        up: false,
        down: false
    }
})

const ball = new Sprite({
    velocity: {
        x: 9,
        y: 9
    },
    image: '../assets/Ball.png' 
})

board.image.onload = () => {
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
}

// const key = {
//     a: {
//         pressed: false
//     },
//     d: {
//         pressed: false
//     }
// }

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'a':
            player.key.up = true
            break
        case 'd':
            player.key.down = true
            break
        case 'ArrowLeft':
            player2.key.up = true
            break
        case 'ArrowRight':
            player2.key.down = true
            break
    }
})


window.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'a':
            player.key.up = false
            break
        case 'd':
            player.key.down = false
            break
        case 'ArrowLeft':
            player2.key.up = false
            break
        case 'ArrowRight':
            player2.key.down = false
            break
            
    }
})

async function getData() {

    try {
        const response =  await fetch(`http://localhost:3002/game`)
        const res = await response.json()
        console.log(res)
    }catch(error) {
        console.log(error.message)
    }
}

function inputHandler() {
    // Player 1
    if (player.key.up){

        if (player.position.y - 15 <= 0)
            player.position.y = 0
        else
            player.position.y -=1 * 15
    }
    if (player.key.down) {
        if (player.position.y + 15 + player.image.height >= board.image.height)
            player.position.y = board.image.height - player.image.height
        else
            player.position.y +=1 * 15
    }
    // Player 2
    if (player2.key.up){

        if (player2.position.y - 15 <= 0)
            player2.position.y = 0
        else
            player2.position.y -=1 * 15
        console.log(player2.position)
    }
    if (player2.key.down) {
        if (player2.position.y + 15 + player2.image.height >= board.image.height)
            player2.position.y = board.image.height - player2.image.height
        else
            player2.position.y +=1 * 15
    }
}

function moveBall() {
    if (ball.position !== undefined) {
        ball.position.x += ball.velocity.x
        ball.position.y += ball.velocity.y

        if (ball.position.x <= 0 || ball.position.x  >= board.image.width)
            ball.position = {x: board.image.width / 2, y:board.image.height / 2}

        // if (ball.position.x + ball.image.width >= board.image.width)
        //     ball.velocity.x = -ball.velocity.x
        if (ball.position.y <= 0 || ball.position.y + ball.image.height >= board.image.height)
            ball.velocity.y = -ball.velocity.y

        if (ball.position.x <= player.position.x + player.image.width && ball.position.x >= player.position.x && ball.position.y + ball.image.height >= player.position.y && ball.position.y <= player.position.y + player.image.height) {
            ball.velocity.x = -ball.velocity.x
            ball.position.x = player.position.x + player.image.width
        }

        if (ball.position.x + ball.image.width >= player2.position.x && ball.position.x <= player2.position.x + player2.image.width && ball.position.y + ball.image.height >= player2.position.y && ball.position.y <= player2.position.y + player2.image.height) {
            ball.velocity.x = -ball.velocity.x
            ball.position.x = player2.position.x - ball.image.width
        }
    }
}

function gameAnimation() {
    window.requestAnimationFrame(gameAnimation)  
    board.draw()
    ball.draw()
    player.draw()
    player2.draw()
    moveBall()
    inputHandler()
}

gameAnimation()
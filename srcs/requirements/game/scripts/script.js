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
})

const ball = new Sprite({
    velocity: {
        x: 1.2,
        y: 1.2
    },
    image: '../assets/Ball.png' 
})

board.image.onload = () => {
    board.loaded = true
    player.loaded = true
    ball.loaded = true
    player.position = {
        x: 0,
        y: board.image.height / 2 - player.image.height / 2
    }
    
    ball.position = {
        x: board.image.width / 2 - ball.image.width / 2,
        y: board.image.height / 2 - ball.image.height / 2
    }
}

const key = {
    a: {
        pressed: false
    },
    d: {
        pressed: false
    }
}

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'a':
            key.a.pressed = true
            break
        case 'd':
            key.d.pressed = true
            break
    }
    console.log(ball.position)
})


window.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'a':
            key.a.pressed = false
            break
        case 'd':
            key.d.pressed = false
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
    if (key.a.pressed){

        if (player.position.y - 5 <= 0)
            player.position.y = 0
        else
            player.position.y -=1 * 5
    }
    if (key.d.pressed) {
        if (player.position.y + 5 + player.image.height >= board.image.height)
            player.position.y = board.image.height - player.image.height
        else
            player.position.y +=1 * 5
    }
}

function moveBall() {
    if (ball.position !== undefined) {
        ball.position.x += ball.velocity.x
        ball.position.y += ball.velocity.y

        if  (ball.position.x <= 0)
            ball.position = {x: board.image.width / 2, y:board.image.height / 2}

        if (ball.position.x + ball.image.width >= board.image.width)
            ball.velocity.x = -ball.velocity.x
        if (ball.position.y <= 0 || ball.position.y + ball.image.height >= board.image.height)
            ball.velocity.y = -ball.velocity.y

        if (ball.position.x <= player.position.x + player.image.width && ball.position.x >= player.position.x && ball.position.y + ball.image.height >= player.position.y && ball.position.y <= player.position.y + player.image.height) {
            ball.velocity.x = -ball.velocity.x
            ball.position.x = player.position.x + player.image.width
        }
    }
}

function gameAnimation() {
    window.requestAnimationFrame(gameAnimation)  
    board.draw()
    ball.draw()
    player.draw()
    moveBall()
    inputHandler()
}

gameAnimation()
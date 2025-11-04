import { loadSprites } from "./loadImages.js"

const canvas = document.getElementById("canvas")
const canvasContext = canvas.getContext('2d')
const res = await fetch(`http://localhost:3002/local`)
const game = await res.json()
await loadSprites(game)

fetch(`http://localhost:3002/state/${game.game.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({game})
})


const key = {
    a: {
        pressed: false
    },
    d: {
        pressed: false
    },
    up: {
        pressed: false
    },
    down: {
        pressed: false
    }
}

const ws = new WebSocket(`ws://localhost:8081/`)

ws.addEventListener('open', (event) => {
    console.log("Connected to WebSocket server")
})

ws.addEventListener('message', (event) => {
    const serverGame = JSON.parse(event.data)
    game.player1.position.y = serverGame.player1.position.y
    game.player2.position.y = serverGame.player2.position.y
    game.ball.position.x = serverGame.ball.position.x
    game.ball.position.y = serverGame.ball.position.y
    game.player1.score = serverGame.player1.score
    game.player2.score = serverGame.player2.score
})

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'a':
            key.a.pressed = true
            break
        case 'd':
            key.d.pressed = true
            break
        case 'ArrowLeft':
            key.up.pressed = true
            break
        case 'ArrowRight':
            key.down.pressed = true
            break
    }
    const body = {
        id: game.game.id,
        key: key
    }
    if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify(body))
    else
        console.error("WebSocket is not open")
})



window.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'a':
            key.a.pressed = false
            break
        case 'd':
            key.d.pressed = false
            break
        case 'ArrowLeft':
            key.up.pressed = false
            break
        case 'ArrowRight':
            key.down.pressed = false
            break
    }
    const body = {
        id: game.game.id,
        key: key
    }
    if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify(body))
    else
        console.error("WebSocket is not open")
})

// async function getState() {

//     try {
//         const response =  await fetch(`http://localhost:3002/state/:125`)
//         const res = await response.json()
//         console.log(res)
//         return res
//     }catch(error) {
//         console.log(error.message)
//     }
// }

// function inputHandler() {
//     // Player 1
//     if (game.player1.key.up){

//         if (game.player1.position.y - 15 <= 0)
//             game.player1.position.y = 0
//         else
//             game.player1.position.y -=1 * 15
//     }
//     if (game.player1.key.down) {
//         if (game.player1.position.y + 15 + game.player1.image.height >= game.board.image.height)
//             game.player1.position.y = game.board.image.height - game.player1.image.height
//         else
//             game.player1.position.y +=1 * 15
//     }
//     // Player 2
//     if (game.player2.key.up){

//         if (game.player2.position.y - 15 <= 0)
//             game.player2.position.y = 0
//         else
//             game.player2.position.y -=1 * 15
//     }
//     if (game.player2.key.down) {
//         if (game.player2.position.y + 15 + game.player2.image.height >= game.board.image.height)
//             game.player2.position.y = game.board.image.height - game.player2.image.height
//         else
//             game.player2.position.y +=1 * 15
//     }
// }

// function moveBall() {
//     if (game.ball.position !== undefined) {
//         game.ball.position.x += game.ball.velocity.x
//         game.ball.position.y += game.ball.velocity.y

//         if (game.ball.position.x <= 0) {
//             game.ball.position = {x: game.board.image.width / 2, y:game.board.image.height / 2}
//             game.player2.score++
//         }

//         if (game.ball.position.x >= game.board.image.width) {
//             game.ball.position = {x: game.board.image.width / 2, y:game.board.image.height / 2}
//             game.player1.score++
//         }
//         if (game.ball.position.y <= 0 || game.ball.position.y + game.ball.image.height >= game.board.image.height)
//             game.ball.velocity.y = -game.ball.velocity.y

//         if (game.ball.position.x <= game.player1.position.x + game.player1.image.width && game.ball.position.x >= game.player1.position.x && game.ball.position.y + game.ball.image.height >= game.player1.position.y && game.ball.position.y <= game.player1.position.y + game.player1.image.height) {
//             game.ball.velocity.x = -game.ball.velocity.x
//             game.ball.position.x = game.player1.position.x + game.player1.image.width
//         }

//         if (game.ball.position.x + game.ball.image.width >= game.player2.position.x && game.ball.position.x <= game.player2.position.x + game.player2.image.width && game.ball.position.y + game.ball.image.height >= game.player2.position.y && game.ball.position.y <= game.player2.position.y + game.player2.image.height) {
//             game.ball.velocity.x = -game.ball.velocity.x
//             game.ball.position.x = game.player2.position.x - game.ball.image.width
//         }
//     }
// }

canvasContext.fillStyle = 'white'
canvasContext.font = '30px Arial'
canvasContext.textAlign = 'center'

async function gameAnimation() {
    // const state = await getState()
    const id = window.requestAnimationFrame(gameAnimation)
    // canvasContext.clearRect(0, 0, game.board.image.width, game.board.image.height)
    canvasContext.drawImage(game.board.image, game.board.position.x, game.board.position.y)
    canvasContext.drawImage(game.player1.image, game.player1.position.x, game.player1.position.y)
    canvasContext.drawImage(game.player2.image, game.player2.position.x, game.player2.position.y)
    canvasContext.drawImage(game.ball.image, game.ball.position.x, game.ball.position.y)
    canvasContext.fillText(game.player1.score, game.board.image.width / 2 - 20, 23.5)
    canvasContext.fillText(game.player2.score, game.board.image.width / 2 + 20, 23.5)
    if (game.player1.score == 5)
    {
        cancelAnimationFrame(id)
        canvasContext.fillText("Player 1 wins", game.board.image.width / 2, game.board.image.height / 2)
    }
    if (game.player2.score == 5)
    {
        cancelAnimationFrame(id)
        canvasContext.fillText("Player 2 wins", game.board.image.width / 2, game.board.image.height / 2)
    }
}

gameAnimation()
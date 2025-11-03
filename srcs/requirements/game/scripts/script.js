import { loadSprites } from "./loadimages.js"

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

const ws = new WebSocket(`ws://localhost:3002/ws`)

ws.addEventListener('open', (event) => {
    console.log("Connected to WebSocket server")
})

ws.addEventListener('message', (event) => {
    const serverGame = JSON.parse(event.data)
    game.board = serverGame.board
    game.player1 = serverGame.player1
    game.player2 = serverGame.player2
    game.ball = serverGame.ball
})

window.addEventListener('keydown', (e) => {
    const body = {
        id: game.game.id,
        key: e.key,
        state: true
    }
    if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify(body))
    else
        console.error("WebSocket is not open")
})


// window.addEventListener('keyup', (e) => {
//     switch(e.key) {
//         case 'a':
//             game.player1.key.up = false
//             break
//         case 'd':
//             game.player1.key.down = false
//             break
//         case 'ArrowLeft':
//             game.player2.key.up = false
//             break
//         case 'ArrowRight':
//             game.player2.key.down = false
//             break
            
//     }
// })

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

function inputHandler() {
    // Player 1
    if (game.player1.key.up){

        if (game.player1.position.y - 15 <= 0)
            game.player1.position.y = 0
        else
            game.player1.position.y -=1 * 15
    }
    if (game.player1.key.down) {
        if (game.player1.position.y + 15 + game.player1.image.height >= game.board.image.height)
            game.player1.position.y = game.board.image.height - game.player1.image.height
        else
            game.player1.position.y +=1 * 15
    }
    // Player 2
    if (game.player2.key.up){

        if (game.player2.position.y - 15 <= 0)
            game.player2.position.y = 0
        else
            game.player2.position.y -=1 * 15
    }
    if (game.player2.key.down) {
        if (game.player2.position.y + 15 + game.player2.image.height >= game.board.image.height)
            game.player2.position.y = game.board.image.height - game.player2.image.height
        else
            game.player2.position.y +=1 * 15
    }
}

function moveBall() {
    if (game.ball.position !== undefined) {
        game.ball.position.x += game.ball.velocity.x
        game.ball.position.y += game.ball.velocity.y

        if (game.ball.position.x <= 0) {
            game.ball.position = {x: game.board.image.width / 2, y:game.board.image.height / 2}
            game.player2.score++
        }

        if (game.ball.position.x >= game.board.image.width) {
            game.ball.position = {x: game.board.image.width / 2, y:game.board.image.height / 2}
            game.player1.score++
        }
        if (game.ball.position.y <= 0 || game.ball.position.y + game.ball.image.height >= game.board.image.height)
            game.ball.velocity.y = -game.ball.velocity.y

        if (game.ball.position.x <= game.player1.position.x + game.player1.image.width && game.ball.position.x >= game.player1.position.x && game.ball.position.y + game.ball.image.height >= game.player1.position.y && game.ball.position.y <= game.player1.position.y + game.player1.image.height) {
            game.ball.velocity.x = -game.ball.velocity.x
            game.ball.position.x = game.player1.position.x + game.player1.image.width
        }

        if (game.ball.position.x + game.ball.image.width >= game.player2.position.x && game.ball.position.x <= game.player2.position.x + game.player2.image.width && game.ball.position.y + game.ball.image.height >= game.player2.position.y && game.ball.position.y <= game.player2.position.y + game.player2.image.height) {
            game.ball.velocity.x = -game.ball.velocity.x
            game.ball.position.x = game.player2.position.x - game.ball.image.width
        }
    }
}

canvasContext.fillStyle = 'white'
canvasContext.font = '30px Arial'
canvasContext.textAlign = 'center'




async function gameAnimation() {
    // const state = await getState()
    const id = window.requestAnimationFrame(gameAnimation)
    canvasContext.drawImage(game.board.image, game.board.position.x, game.board.position.y)
    canvasContext.drawImage(game.player1.image, game.player1.position.x, game.player1.position.y)
    canvasContext.drawImage(game.player2.image, game.player2.position.x, game.player2.position.y)
    canvasContext.drawImage(game.ball.image, game.ball.position.x, game.ball.position.y)
    moveBall()
    inputHandler()
    canvasContext.fillText(game.player1.score, game.board.image.width / 2 - 20, 23.5)
    canvasContext.fillText(game.player2.score, game.board.image.width / 2 + 20, 23.5)
    if (game.player1.score == 500)
    {
        cancelAnimationFrame(id)
        canvasContext.fillText("Player 1 wins", game.board.image.width / 2, game.board.image.height / 2)
    }
    if (game.player2.score == 500)
    {
        cancelAnimationFrame(id)
        canvasContext.fillText("Player 2 wins", game.board.image.width / 2, game.board.image.height / 2)
    }
}

gameAnimation()
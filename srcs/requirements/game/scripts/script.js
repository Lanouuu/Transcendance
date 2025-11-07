import { loadSprites } from "./loadImages.js"

const canvas = document.getElementById("canvas")
const canvasContext = canvas.getContext('2d')
const res = await fetch(`http://localhost:3002/local`)
const game = await res.json()
// console.log("BEFORE ", game)
await loadSprites(game)

// console.log("AFTER ", game)
// fetch(`http://localhost:3002/state/${game.game.id}`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({game})
// })

const ws = new WebSocket(`ws://localhost:8081/`)

ws.addEventListener('open', (event) => {
    game.message = "Init"
    // console.log("GAME IN OPEN ", game)
    if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify(game))
})

ws.addEventListener('message', (event) => {
    const serverGame = JSON.parse(event.data)
    // console.log("GAME IN MESSAGE ", serverGame)
    game.player1.position.y = serverGame.player1.position.y
    game.player2.position.y = serverGame.player2.position.y
    game.ball.position.x = serverGame.ball.position.x
    game.ball.position.y = serverGame.ball.position.y
    game.player1.score = serverGame.player1.score
    game.player2.score = serverGame.player2.score
    game.message = serverGame.message
    if (game.message === "END")
    {
        game.winner = serverGame.winner
        game.displayWinner = serverGame.displayWinner
    }
})

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'a':
            game.player1.key.up = true
            break
        case 'd':
            game.player1.key.down = true
            break
        case 'ArrowLeft':
            game.player2.key.up = true
            break
        case 'ArrowRight':
            game.player2.key.down = true
            break
    }
    game.message = "input"
    if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify(game))
    else
        console.error("WebSocket is not open")
})



window.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'a':
            game.player1.key.up = false
            break
        case 'd':
            game.player1.key.down = false
            break
        case 'ArrowLeft':
            game.player2.key.up = false
            break
        case 'ArrowRight':
            game.player2.key.down = false
            break
    }
    game.message = "input"
    if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify(game))
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

canvasContext.fillStyle = 'white'
canvasContext.font = '30px Arial'
canvasContext.textAlign = 'center'

async function gameAnimation() {
    const id = window.requestAnimationFrame(gameAnimation)  
    canvasContext.drawImage(game.board.image, game.board.position.x, game.board.position.y)
    canvasContext.drawImage(game.player1.image, game.player1.position.x, game.player1.position.y)
    canvasContext.drawImage(game.player2.image, game.player2.position.x, game.player2.position.y)
    canvasContext.drawImage(game.ball.image, game.ball.position.x, game.ball.position.y)
    canvasContext.fillText(game.player1.score, game.board.image.width / 2 - 20, 23.5)
    canvasContext.fillText(game.player2.score, game.board.image.width / 2 + 20, 23.5)
    // const response = await fetch(`http://localhost:3002/state/${game.id}`)
    // const state = await response.json()
    // console.log("GAME STATE = ", state)
    if (game.message === "END") {
        cancelAnimationFrame(id)
        canvasContext.fillText(game.displayWinner, game.board.image.width / 2, game.board.image.height / 2)
    }
}

gameAnimation()
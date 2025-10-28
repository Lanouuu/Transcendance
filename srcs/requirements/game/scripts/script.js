import { loadSprites } from "./loadImages"

const canvas = document.getElementById("canvas")
const canvasContext = canvas.getContext('2d')

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

// async function getData() {

//     try {
//         const response =  await fetch(`http://localhost:3002/game`)
//         const res = await response.json()
//         console.log(res)
//     }catch(error) {
//         console.log(error.message)
//     }
// }

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

        if (ball.position.x <= 0) {
            ball.position = {x: board.image.width / 2, y:board.image.height / 2}
            player2.score++
        }

        if (ball.position.x >= board.image.width) {
            ball.position = {x: board.image.width / 2, y:board.image.height / 2}
            player.score++
        }
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

canvasContext.fillStyle = 'white'
canvasContext.font = '30px Arial'
canvasContext.textAlign = 'center'

async function gameAnimation() {

    const [board, player, player2, ball] = await loadSprites()
    const id = window.requestAnimationFrame(gameAnimation)  
    board.draw()
    ball.draw()
    player.draw()
    player2.draw()
    moveBall()
    inputHandler()
    canvasContext.fillText(player.score, board.image.width / 2 - 20, 23.5)
    canvasContext.fillText(player2.score, board.image.width / 2 + 20, 23.5)
    if (player.score == 5)
    {
        cancelAnimationFrame(id)
        canvasContext.fillText("Player 1 wins", board.image.width / 2, board.image.height / 2)
    }
    if (player2.score == 5)
    {
        cancelAnimationFrame(id)
        canvasContext.fillText("Player 2 wins", board.image.width / 2, board.image.height / 2)
    }
}

gameAnimation()
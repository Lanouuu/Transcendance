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

player.position = {
    x: 0,
    y: board.image.height / 2 - player.image.height / 2
}

const ball = new Sprite({
    image: '../assets/Ball.png' 
})


ball.position = {
    x: board.image.width / 2 - ball.image.width / 2,
    y: board.image.height / 2 - ball.image.height / 2
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

function gameAnimation() {
    window.requestAnimationFrame(gameAnimation)  
    board.draw()
    player.draw()
    ball.draw()
    if (key.a.pressed){
        if (player.position.y != 0) {
            if (player.position.y > 0 && player.position.y < 1)
                player.position.y -= player.position.y
            else
                player.position.y -=1 * 5
            console.log(player.position.y)
        }
        if (player.position.y <= 0)
        {
            console.log("Collision")
            player.position.y = 0;
        }
    }
    if (key.d.pressed) {
        if (player.position.y + player.image.height != board.image.height) {
            if (player.position.y + player.image.height < board.image.height && player.position.y + player.image.height > board.image.height - 1)
                player.position.y += board.image.height - (player.position.y + player.image.height) 
            else
                player.position.y +=1 * 5
            console.log(player.position.y + player.image.height)
        }
    }

}

gameAnimation()
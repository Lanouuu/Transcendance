import { Game, Sprite, Vector2D, KeyBind, ImgSize } from "./gameClass.js"

const route: string = "://localhost:8443/game";

export async function launchLocalGame() {

	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");
	const remoteButton: HTMLButtonElement = document.getElementById('gameRemoteGameButton') as HTMLButtonElement;

	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	if (remoteButton) {
		remoteButton.style.display = "none";
	}

	try {
		const res = await fetch(`https${route}/local`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (!res.ok) {
			const text = await res.text();
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to load the game`);
		}
			
		const contentType = res.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			const text = await res.text();
			console.error(`Server did not return JSON`, text);
			throw new Error(`Server response is not JSON`);
		}

		const game = await res.json();
		gameLoop(game);
	} catch (err) {
		console.error(err);
	}
};

export async function launchRemoteGame() {

	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");
	const localButton: HTMLButtonElement = document.getElementById('gameLocalGameButton') as HTMLButtonElement;
	
	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	if (localButton){
		localButton.style.display = "none";
	}


	try {
		const res = await fetch(`https${route}/remote`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (!res.ok) {
			const text = await res.text();
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to load the game`);
		}
			
		const contentType = res.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			const text = await res.text();
			console.error(`Server did not return JSON`, text);
			throw new Error(`Server response is not JSON`);
		}

		const game = await res.json();
		gameLoop(game);
	} catch (err) {
		console.error(err);
	}
}

export async function gameLoop(game: Game) { // BIZARRE LE TYPE

	try {
		await loadSprites(game);
		const ws = new WebSocket(`wss${route}/ws`); // A MODIFIER

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
			if (game.message === "END") {
				game.winner = serverGame.winner
				game.displayWinner = serverGame.displayWinner
			}
		})

		window.addEventListener('keydown', (e) => {
			switch (e.key) {
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
			switch (e.key) {
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
		console.log('Sprite loaded');
		gameAnimation(game);
	} catch (error) {
		console.error(error);
	}
}

async function gameAnimation(game: Game) {

	const canvas: HTMLCanvasElement = document.getElementById("canvas") as HTMLCanvasElement;
	const button: HTMLButtonElement = document.getElementById("gameLocalGameButton") as HTMLButtonElement;
	if (canvas === null || button === null) {
		console.error('Could not fetch canvas or button');
		return;
	}
	const canvasContext = canvas.getContext('2d');
	if (canvasContext === null) {
		console.error('Could not fetch canvas context');
		return;
	}

	canvas.style.display = 'block';
	button.style.display = 'none';
	canvasContext.fillStyle = 'white'
	canvasContext.font = '30px Arial'
	canvasContext.textAlign = 'center'

	const id = window.requestAnimationFrame(() => gameAnimation(game))
	canvasContext.drawImage(game.board.image, game.board.position.x, game.board.position.y)
	canvasContext.drawImage(game.player1.image, game.player1.position.x, game.player1.position.y)
	canvasContext.drawImage(game.player2.image, game.player2.position.x, game.player2.position.y)
	canvasContext.drawImage(game.ball.image, game.ball.position.x, game.ball.position.y)
	canvasContext.fillText(String(game.player1.score), game.board.image.width / 2 - 20, 23.5)
	canvasContext.fillText(String(game.player2.score), game.board.image.width / 2 + 20, 23.5)
	if (game.message === "END") {
		cancelAnimationFrame(id)
		canvasContext.fillText(game.displayWinner, game.board.image.width / 2, game.board.image.height / 2)
	}
}


async function loadImage (imagePath: string, velocity: Vector2D, key: KeyBind, score: number | undefined) : Promise<Sprite>{
    return new Promise((resolve, reject) => {
        const img = new Sprite({
			position: { x: 0 , y: 0 },
            velocity: velocity,
            imageSrc: imagePath,
			imgSize: { height: 0 , width: 0},
            key: key,
            score: score
        })
        img.image.onload = () => resolve(img)
        img.image.onerror = () => reject(new Error(`Error, image ${imagePath} couldn't be load`))
    })
}

function initSprite(board: Sprite, player1: Sprite, player2: Sprite, ball: Sprite) {
        board.loaded = true
        player1.loaded = true
        player2.loaded = true
        ball.loaded = true
        
        board.position = {
            x: 0,
            y: 0
        }
        board.imgSize.height = board.image.height
        board.imgSize.width = board.image.width

        player1.position = {
            x: 0,
            y: board.image.height / 2 - player1.image.height / 2
        }
        player1.imgSize.height = player1.image.height
        player1.imgSize.width = player1.image.width

        player2.position = {
            x: board.image.width - player2.image.width,
            y: board.image.height / 2 - player2.image.height / 2
        }
        player2.imgSize.height = player2.image.height
        player2.imgSize.width = player2.image.width
        
        ball.position = {
            x: board.image.width / 2 - ball.image.width / 2,
            y: board.image.height / 2 - ball.image.height / 2
        }
        ball.imgSize.height = ball.image.height
        ball.imgSize.width = ball.image.width
}

export async function loadSprites(game: Game) {
    try {
        const [board, player1, player2, ball] = await Promise.all([
            loadImage('../assets/pong/Board.png', {x:0, y:0}, {up: undefined, down: undefined}, undefined),
            loadImage('../assets/pong/Player.png', {x:0, y:0}, {up: false, down: false}, 0),
            loadImage('../assets/pong/Player2.png', {x:0, y:0}, {up: false, down: false}, 0),
            loadImage('../assets/pong/Ball.png', {x:-9, y:9}, {up: undefined, down: undefined}, undefined)]
        )
        initSprite(board, player1, player2, ball)
        game.board = board;
        game.player1 = player1;
        game.player2 = player2;
        game.ball = ball;
        // return [board, player, player2, ball]
    }catch(e) {
        console.error("ERREUR CHARGEMENT IMAGES", e);
        // return []
    }
}
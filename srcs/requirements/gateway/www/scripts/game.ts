import { Game, Sprite, Vector2D, KeyBind, ImgSize } from "./gameClass.js"
import { SnakeGame } from "./snakeGame.js"


const route: string = `${window.location.origin}/game`;
const ws_route: string = `://${window.location.host}/game`;
const snake_route: string = `${window.location.origin}/second_game`;
const snake_ws_route: string = `://${window.location.host}/second_game`;

export async function setupGamePage(): Promise<void> {
	
	const initButtons = () => {
		const remoteButton: HTMLButtonElement = document.getElementById('gameRemoteGameButton') as HTMLButtonElement;
		const localButton: HTMLButtonElement = document.getElementById('gameLocalGameButton') as HTMLButtonElement;
		const snakeLocalButton: HTMLButtonElement = document.getElementById('snakeLocalGameButton') as HTMLButtonElement;
		const snakeRemoteButton: HTMLButtonElement = document.getElementById('snakeRemoteGameButton') as HTMLButtonElement;
		const gameMenu: HTMLElement = document.getElementById('gameSelectionMenu') as HTMLElement;


		if (!remoteButton || !localButton || !snakeLocalButton || !snakeRemoteButton) {
			console.error("Could not fetch game buttons");
			return ;
		}

		localButton.addEventListener('click', async () => {
			console.log("localGameBUtton");	
			localButton.classList.add('hidden');
			remoteButton.classList.add('hidden');
			launchLocalGame();
		});
		remoteButton.addEventListener('click', async () => {
			launchRemoteGame();
			localButton.classList.add('hidden');
			remoteButton.classList.add('hidden');
			console.log("remoteGameBUtton");	
		});
		snakeLocalButton.addEventListener('click', async () => {
			console.log("snakeLocalGameButton");
			if (gameMenu) gameMenu.classList.add('hidden');
			launchSnakeLocalGame();
		});
		snakeRemoteButton.addEventListener('click', async () => {
			console.log("snakeRemoteGameButton");
			if (gameMenu) gameMenu.classList.add('hidden');
			launchSnakeRemoteGame();
		});
	};


	initButtons();


}


async function launchLocalGame() {

	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");
	const remoteButton: HTMLButtonElement = document.getElementById('gameRemoteGameButton') as HTMLButtonElement;

	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	try {
		const res = await fetch(`${route}/local`, {
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

async function launchRemoteGame() {

	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");
	const localButton: HTMLButtonElement = document.getElementById('gameLocalGameButton') as HTMLButtonElement;
	
	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	try {
		const res = await fetch(`${route}/remote`, {
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
		// console.log(res.text());
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

async function gameLoop(game: Game) { // BIZARRE LE TYPE

	try {
		await loadSprites(game);
		const ws = new WebSocket(`wss${ws_route}/ws`); // A MODIFIER
		ws.addEventListener('open', (event) => {
			// game.message = "Init"
			// console.log("GAME IN OPEN ", game)
			if (ws.readyState === WebSocket.OPEN)
				ws.send(JSON.stringify({game, message: "Init"}))
		})

		ws.addEventListener('message', (event) => {
			const serverGame = JSON.parse(event.data)
			game.message = serverGame.message
			if (serverGame.message === "Countdown") {
				game.timer = serverGame.timer
			}
			else if (serverGame.message === "Playing") {
				game.started = serverGame.started
				game.player1.sprite.position.y = serverGame.player1.sprite.position.y
				game.player2.sprite	.position.y = serverGame.player2.sprite.position.y
				game.ball.position.x = serverGame.ball.position.x
				game.ball.position.y = serverGame.ball.position.y
				game.player1.score = serverGame.player1.score
				game.player2.score = serverGame.player2.score
			}
			else if (game.message === "END") {
				game.winner = serverGame.winner
				game.displayWinner = serverGame.displayWinner
				game.player1.score = serverGame.player1.score
				game.player2.score = serverGame.player2.score
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
			if (ws.readyState === WebSocket.OPEN)
				ws.send(JSON.stringify({game, message: "input"}))
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
			if (ws.readyState === WebSocket.OPEN)
				ws.send(JSON.stringify({game, message: "input"}))
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
	if (canvas === null) {
		console.error('Could not fetch canvas or button');
		return;
	}
	const canvasContext = canvas.getContext('2d');
	if (canvasContext === null) {
		console.error('Could not fetch canvas context');
		return;
	}

	canvas.classList.remove('hidden');
	canvasContext.fillStyle = 'white'
	canvasContext.font = '30px Arial'
	canvasContext.textAlign = 'center'

	const id = window.requestAnimationFrame(() => gameAnimation(game))
	canvasContext.drawImage(game.board.image, game.board.position.x, game.board.position.y)
	canvasContext.drawImage(game.player1.sprite.image, game.player1.sprite.position.x, game.player1.sprite.position.y)
	canvasContext.drawImage(game.player2.sprite.image, game.player2.sprite.position.x, game.player2.sprite.position.y)
	canvasContext.drawImage(game.ball.image, game.ball.position.x, game.ball.position.y)
	canvasContext.fillText(String(game.player1.score), game.board.image.width / 2 - 20, 23.5)
	canvasContext.fillText(String(game.player2.score), game.board.image.width / 2 + 20, 23.5)
	if (game.message === "Countdown") {
		canvasContext.fillText(game.timer === 0 ? "GO !" : game.timer.toString(), game.board.image.width / 2, game.board.image.height / 2)
	}
	else if (game.message === "END") {
		canvasContext.fillText(game.displayWinner, game.board.image.width / 2, game.board.image.height / 2)
		cancelAnimationFrame(id)
	}
}


async function loadImage (imagePath: string, velocity: Vector2D) : Promise<Sprite>{
    return new Promise((resolve, reject) => {
        const img = new Sprite({
			position: { x: 0 , y: 0 },
            velocity: velocity,
            imageSrc: imagePath,
			imgSize: { height: 0 , width: 0},
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

async function loadSprites(game: Game) {
    try {
        const [board, player1, player2, ball] = await Promise.all([
            loadImage('../assets/pong/Board.png', {x:0, y:0}),
            loadImage('../assets/pong/Player.png', {x:0, y:0}),
            loadImage('../assets/pong/Player2.png', {x:0, y:0}),
            loadImage('../assets/pong/Ball.png', {x:-9, y:9})]
        )
        initSprite(board, player1, player2, ball)
        game.board = board;
        game.player1.sprite = player1;
        game.player2.sprite = player2;
        game.ball = ball;
    }catch(e) {
        console.error("ERREUR CHARGEMENT IMAGES", e);
    }
}


// Snake Game Functions

async function launchSnakeLocalGame() {
	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");

	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	try {
		const res = await fetch(`${snake_route}/local`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (!res.ok) {
			const text = await res.text();
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to load Snake game`);
		}

		const contentType = res.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			const text = await res.text();
			console.error(`Server did not return JSON`, text);
			throw new Error(`Server response is not JSON`);
		}

		const gameData = await res.json();
		const game = new SnakeGame(gameData);
		snakeGameLoop(game);
	} catch (err) {
		console.error(err);
	}
}

async function launchSnakeRemoteGame() {
	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");

	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	try {
		const res = await fetch(`${snake_route}/remote`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (!res.ok) {
			const text = await res.text();
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to load Snake game`);
		}

		const contentType = res.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			const text = await res.text();
			console.error(`Server did not return JSON`, text);
			throw new Error(`Server response is not JSON`);
		}

		const gameData = await res.json();
		const game = new SnakeGame(gameData);
		snakeGameLoop(game);
	} catch (err) {
		console.error(err);
	}
}

async function snakeGameLoop(game: SnakeGame) {
	try {
		const ws = new WebSocket(`wss${snake_ws_route}/ws`);
		game.socket = ws;

		ws.addEventListener('open', () => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({game, message: "Init"}));
			}
		});

		ws.addEventListener('message', (event) => {
			const serverGame = JSON.parse(event.data);
			game.updateFromServer(serverGame);
		});

		ws.addEventListener('error', (error) => {
			console.error('WebSocket error:', error);
		});

		ws.addEventListener('close', () => {
			console.log('WebSocket connection closed');
		});

		// Input handling
		window.addEventListener('keydown', (e) => {
			let updated = false;

			// Player 1: WASD
			switch(e.key) {
				case 'w':
				case 'W':
					game.player1.nextDirection = {x: 0, y: -1};
					updated = true;
					break;
				case 's':
				case 'S':
					game.player1.nextDirection = {x: 0, y: 1};
					updated = true;
					break;
				case 'a':
				case 'A':
					game.player1.nextDirection = {x: -1, y: 0};
					updated = true;
					break;
				case 'd':
				case 'D':
					game.player1.nextDirection = {x: 1, y: 0};
					updated = true;
					break;

				// Player 2: Arrow keys
				case 'ArrowUp':
					game.player2.nextDirection = {x: 0, y: -1};
					updated = true;
					break;
				case 'ArrowDown':
					game.player2.nextDirection = {x: 0, y: 1};
					updated = true;
					break;
				case 'ArrowLeft':
					game.player2.nextDirection = {x: -1, y: 0};
					updated = true;
					break;
				case 'ArrowRight':
					game.player2.nextDirection = {x: 1, y: 0};
					updated = true;
					break;
			}

			if (updated && ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({game, message: "input"}));
			}
		});

		// Start rendering
		snakeAnimation(game);
	} catch (error) {
		console.error(error);
	}
}

function snakeAnimation(game: SnakeGame) {
	const canvas = document.getElementById("snakeCanvas") as HTMLCanvasElement;
	const ctx = canvas.getContext('2d');

	if (!ctx || !canvas) {
		console.error('Could not fetch snake canvas or context');
		return;
	}

	// Show canvas
	canvas.classList.remove('hidden');

	// Set canvas size based on grid
	canvas.width = game.grid.width * game.grid.cellSize;
	canvas.height = game.grid.height * game.grid.cellSize;

	const render = () => {
		// Clear canvas
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw grid (optional - subtle)
		ctx.strokeStyle = '#1a1a1a';
		ctx.lineWidth = 1;
		for (let x = 0; x <= game.grid.width; x++) {
			ctx.beginPath();
			ctx.moveTo(x * game.grid.cellSize, 0);
			ctx.lineTo(x * game.grid.cellSize, canvas.height);
			ctx.stroke();
		}
		for (let y = 0; y <= game.grid.height; y++) {
			ctx.beginPath();
			ctx.moveTo(0, y * game.grid.cellSize);
			ctx.lineTo(canvas.width, y * game.grid.cellSize);
			ctx.stroke();
		}

		// Draw Player 1 snake
		if (game.player1.snake && game.player1.snake.length > 0) {
			game.player1.snake.forEach((segment, index) => {
				const alpha = index === 0 ? 1 : 0.8; // Head brighter
				ctx.globalAlpha = alpha;
				ctx.fillStyle = game.player1.color;
				ctx.fillRect(
					segment.x * game.grid.cellSize + 1,
					segment.y * game.grid.cellSize + 1,
					game.grid.cellSize - 2,
					game.grid.cellSize - 2
				);
			});
		}

		// Draw Player 2 snake
		if (game.player2.snake && game.player2.snake.length > 0) {
			game.player2.snake.forEach((segment, index) => {
				const alpha = index === 0 ? 1 : 0.8; // Head brighter
				ctx.globalAlpha = alpha;
				ctx.fillStyle = game.player2.color;
				ctx.fillRect(
					segment.x * game.grid.cellSize + 1,
					segment.y * game.grid.cellSize + 1,
					game.grid.cellSize - 2,
					game.grid.cellSize - 2
				);
			});
		}

		ctx.globalAlpha = 1;

		// Draw UI text
		ctx.fillStyle = '#FFFFFF';
		ctx.font = '24px Arial';
		ctx.textAlign = 'center';

		// Draw scores at top
		ctx.fillText(
			`${game.player1.name || 'Player 1'}: ${game.player1.snake.length}`,
			canvas.width / 4,
			30
		);
		ctx.fillText(
			`${game.player2.name || 'Player 2'}: ${game.player2.snake.length}`,
			(canvas.width * 3) / 4,
			30
		);

		// Draw game state messages
		if (game.message === "Countdown") {
			ctx.font = '48px Arial';
			ctx.fillText(
				game.timer === 0 ? "GO!" : game.timer.toString(),
				canvas.width / 2,
				canvas.height / 2
			);
		} else if (game.message === "Waiting") {
			ctx.font = '36px Arial';
			ctx.fillText(
				"Waiting for opponent...",
				canvas.width / 2,
				canvas.height / 2
			);
		} else if (game.message === "END") {
			ctx.font = '36px Arial';
			ctx.fillText(game.displayWinner, canvas.width / 2, canvas.height / 2);
			// Stop animation
			return;
		}

		requestAnimationFrame(render);
	};

	render();
}
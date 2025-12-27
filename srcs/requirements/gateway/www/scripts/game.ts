import { Game, Sprite, Vector2D, KeyBind, ImgSize } from "./gameClass.js"
import { login } from "./login.js";
import { SnakeGame, GridPosition } from "./snakeGame.js"


const route: string = `${window.location.origin}/game`;
const ws_route: string = `://${window.location.host}/game`;
const snake_route: string = `${window.location.origin}/second_game`;
const snake_ws_route: string = `://${window.location.host}/second_game`;

// Variables globales pour gérer le replay
let currentSnakeGameMode: 'local' | 'remote' | null = null;
let currentWebSocket: WebSocket | null = null;
let currentAnimationId: number | null = null;

async function checkToken(): Promise<boolean> {
	const token = sessionStorage.getItem("jwt");
	if (!token) {
		return false;
	}
	try {
		const response = await fetch(`${window.location.origin}/auth_service/verify`, {
			headers: { "Authorization": `Bearer ${token}` }
		});
		if (!response.ok) {
			return false;
		}
		return true;
	} catch (error) {
		console.error("Auth check failed:", error);
		return false;
	}
}

export async function setupGamePage(): Promise<void> {

	const loginRedirectButton: HTMLButtonElement = document.getElementById('loginRedirectButton') as HTMLButtonElement;

	const boxGamePong: HTMLDivElement = document.getElementById("boxGamePong") as HTMLDivElement;
	const boxGameSnake: HTMLDivElement = document.getElementById("boxGameSnake") as HTMLDivElement;
	const pongLocalButton: HTMLButtonElement = document.getElementById('pongLocalGameButton') as HTMLButtonElement;
	const pongRemoteButton: HTMLButtonElement = document.getElementById('pongRemoteGameButton') as HTMLButtonElement;
	const snakeLocalButton: HTMLButtonElement = document.getElementById('snakeLocalGameButton') as HTMLButtonElement;
	const snakeRemoteButton: HTMLButtonElement = document.getElementById('snakeRemoteGameButton') as HTMLButtonElement;

	const isOnline = await checkToken();
	if (!isOnline) {
		loginRedirectButton.classList.remove('hidden');
	} else {
		boxGamePong.classList.remove('hidden');
		boxGamePong.classList.add('flex');
		boxGameSnake.classList.remove('hidden');
		boxGameSnake.classList.add('flex');
	}

	loginRedirectButton.addEventListener('click', async () => {
		window.location.hash = "#login";
	});

	pongLocalButton.addEventListener('click', async () => {
		boxGamePong.classList.remove('flex');
		boxGamePong.classList.add('hidden');
		boxGameSnake.classList.remove('flex');
		boxGameSnake.classList.add('hidden');
		launchLocalGame();
	});

	pongRemoteButton.addEventListener('click', async () => {
		boxGamePong.classList.remove('flex');
		boxGamePong.classList.add('hidden');
		boxGameSnake.classList.remove('flex');
		boxGameSnake.classList.add('hidden');
		launchRemoteGame();
	});

	snakeLocalButton.addEventListener('click', async () => {
		boxGamePong.classList.remove('flex');
		boxGamePong.classList.add('hidden');
		boxGameSnake.classList.remove('flex');
		boxGameSnake.classList.add('hidden');
		launchSnakeLocalGame();
	});

	snakeRemoteButton.addEventListener('click', async () => {
		boxGamePong.classList.remove('flex');
		boxGamePong.classList.add('hidden');
		boxGameSnake.classList.remove('flex');
		boxGameSnake.classList.add('hidden');
		launchSnakeRemoteGame();
	});
}


async function launchLocalGame() {

	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");

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

		const response = await res.json();
		if (response.message === "Success") {
			let game : Game;
			const ws = new WebSocket(`wss${ws_route}/ws`); // A MODIFIER
			ws.addEventListener('open', (event) => {
				if (ws.readyState === WebSocket.OPEN)
					ws.send(JSON.stringify({id: userId, message: "InitLocal"}))
			})

			ws.addEventListener('message', (event) => {
				const serverGame = JSON.parse(event.data)
				if (serverGame.message === "Init") {
					game = serverGame.game;
					gameLoop(game, ws);
				}
				else if (game && serverGame.message === "Countdown") {
					game.message = serverGame.message
					game.timer = serverGame.timer
				}
				else if (game && serverGame.message === "Playing") {
					game.message = serverGame.message
					game.started = serverGame.started
					game.player1.sprite.position.y = serverGame.player1.sprite.position.y
					game.player2.sprite.position.y = serverGame.player2.sprite.position.y
					game.ball.position.x = serverGame.ball.position.x
					game.ball.position.y = serverGame.ball.position.y
					game.player1.score = serverGame.player1.score
					game.player2.score = serverGame.player2.score
				}
				else if (game && serverGame.message === "END") {
					game.message = serverGame.message
					game.winner = serverGame.winner
					game.displayWinner = serverGame.displayWinner
					game.player1.score = serverGame.player1.score
					game.player2.score = serverGame.player2.score
				}
				else if (serverGame.message === "Error") {
					console.log(serverGame.error)
				}
			})
		}
	} catch (err) {
		console.error(err);
	}
};

async function launchRemoteGame() {

	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");
	
	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	try {
		const res = await fetch(`${route}/remote`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({message: "matchmaking"})
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
		
		const response = await res.json();
		if (response.message === "Success") {
			let game : Game;
			const ws = new WebSocket(`wss${ws_route}/ws`); // A MODIFIER
			ws.addEventListener('open', (event) => {
				if (ws.readyState === WebSocket.OPEN)
					ws.send(JSON.stringify({id: response.id, message: "InitRemote"}))
			})

			ws.addEventListener('message', (event) => {
				const serverGame = JSON.parse(event.data)
				if (serverGame.message === "Init") {
					game = serverGame.game;
					gameLoop(game, ws);
				}
				else if (game && serverGame.message === "Countdown") {
					game.message = serverGame.message
					game.timer = serverGame.timer
				}
				else if (game && serverGame.message === "Playing") {
					game.message = serverGame.message
					game.started = serverGame.started
					game.player1.sprite.position.y = serverGame.player1.sprite.position.y
					game.player2.sprite.position.y = serverGame.player2.sprite.position.y
					game.ball.position.x = serverGame.ball.position.x
					game.ball.position.y = serverGame.ball.position.y
					game.player1.score = serverGame.player1.score
					game.player2.score = serverGame.player2.score
				}
				else if (game && serverGame.message === "END") {
					game.message = serverGame.message
					game.winner = serverGame.winner
					game.displayWinner = serverGame.displayWinner
					game.player1.score = serverGame.player1.score
					game.player2.score = serverGame.player2.score
				}
			})
		}
	} catch (err) {
		console.error(err);
	}
}

export async function launchInvitGame(friendId: string, message: string) {
	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");
	const localButton: HTMLButtonElement = document.getElementById('gameLocalGameButton') as HTMLButtonElement;
	
	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}
	try {
		const res = await fetch(`${route}/remote`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({friendId: friendId, message: message})
		});
		if (message === "deny-invit")
			return;
		if (!res.ok) {
			const text = await res.text();
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to load the game`);
		}
		// console.log(res.text());
		// const contentType = res.headers.get("content-type");
		// if (!contentType || !contentType.includes("application/json")) {
		// 	const text = await res.text();
		// 	console.error(`Server did not return JSON`, text);
		// 	throw new Error(`Server response is not JSON`);
		// }
		
		const response = await res.json();
		if (response.message === "Success") {
			let game : Game;
			const ws = new WebSocket(`wss${ws_route}/ws`); // A MODIFIER
			ws.addEventListener('open', (event) => {
				if (ws.readyState === WebSocket.OPEN)
					ws.send(JSON.stringify({id: response.id, message: "InitRemote"}))
			})

			ws.addEventListener('message', (event) => {
				const serverGame = JSON.parse(event.data)
				console.log(serverGame.message);
				if (serverGame.message === "Init") {
					const cancelMatchButton: HTMLButtonElement = document.getElementById('cancelMatchButton') as HTMLButtonElement;
					if (cancelMatchButton) {
						cancelMatchButton.classList.remove('hidden');
						cancelMatchButton.onclick = async () => {
							const res = await fetch(`${window.location.origin}/game/remote`, {
            			    	method: "POST",
            			    	headers: {
            			    	    "x-user-id": userId,
            			    	    "authorization": `Bearer ${token}`,
            			    	    "Content-Type": "application/json"
            			    	},
            			    	body: JSON.stringify({ friendId: friendId, message: "deny-invit" })
            				});
            				if (!res.ok) {
            		    		console.error("Could not clear invit");
            				}
							window.location.hash = "#account";
						}
					}
					game = serverGame.game;
					gameLoop(game, ws);
				}
				else if (serverGame.message === "deny-invit") {
					const gameQueueMsg: HTMLDivElement = document.getElementById("gameQueueMsg") as HTMLDivElement;

					if (gameQueueMsg) {
						gameQueueMsg.classList.toggle('opacity-0');
						gameQueueMsg.classList.toggle('opacity-100');
						gameQueueMsg.textContent = "Your invitation has been denied ! haha";
						// aPIMPER
					}
				}
				else if (game && serverGame.message === "Countdown") {
					game.message = serverGame.message
					game.timer = serverGame.timer
				}
				else if (game && serverGame.message === "Playing") {
					const cancelMatchButton: HTMLButtonElement = document.getElementById('cancelMatchButton') as HTMLButtonElement;				
					if (cancelMatchButton)
						cancelMatchButton.classList.add('hidden');
					game.message = serverGame.message
					game.started = serverGame.started
					game.player1.sprite.position.y = serverGame.player1.sprite.position.y
					game.player2.sprite.position.y = serverGame.player2.sprite.position.y
					game.ball.position.x = serverGame.ball.position.x
					game.ball.position.y = serverGame.ball.position.y
					game.player1.score = serverGame.player1.score
					game.player2.score = serverGame.player2.score
				}
				else if (game && serverGame.message === "END") {
					game.message = serverGame.message
					game.winner = serverGame.winner
					game.displayWinner = serverGame.displayWinner
					game.player1.score = serverGame.player1.score
					game.player2.score = serverGame.player2.score
				}
			})
		}
	} catch (err) {
		console.error(err);
	}
}

export async function gameLoop(game: Game, ws: WebSocket) {

	try {
		await loadSprites(game);

		window.addEventListener('keydown', (e) => {
			let key;
			switch (e.key) {
				case 'a':
					key = 'a'
					break
				case 'd':
					key = 'd'
					break
				case 'ArrowLeft':
					key = 'ArrowLeft'
					break
				case 'ArrowRight':
					key = 'ArrowRight'
					break
			}
			if (ws.readyState === WebSocket.OPEN)
				ws.send(JSON.stringify({id: game.id, message: "input", key, event: "keydown"}))
			else
				console.error("WebSocket is not open")
		})

		window.addEventListener('keyup', (e) => {
			let key;
			switch (e.key) {
				case 'a':
					key = 'a'
					break
				case 'd':
					key = 'd'
					break
				case 'ArrowLeft':
					key = 'ArrowLeft'
					break
				case 'ArrowRight':
					key = 'ArrowRight'
					break
			}
			if (ws.readyState === WebSocket.OPEN)
				ws.send(JSON.stringify({id: game.id, message: "input", key, event: "keyup"}))
			else
				console.error("WebSocket is not open")
		})
		console.log('Sprite loaded');
		const canvas: HTMLCanvasElement = document.createElement('canvas');
		const canvasDiv: HTMLDivElement = document.getElementById('canvasDiv') as HTMLDivElement;

		canvas.id = String(game.id);
    	canvas.width= 802;
		canvas.height= 455;
		canvas.className = "bg-color-black";

		if (!canvas || !canvasDiv) {
			console.error('Could not fetch canvas div');
			return;
		}
		canvasDiv.appendChild(canvas);
		gameAnimation(game, canvas);
	} catch (error) {
		console.error(error);
	}
}

async function gameAnimation(game: Game, canvas: HTMLCanvasElement) {

	
	const canvasContext = canvas.getContext('2d');
	if (canvasContext === null) {
		console.error('Could not fetch canvas context');
		return;
	}

	canvasContext.fillStyle = 'white'
	canvasContext.font = '30px Arial'
	canvasContext.textAlign = 'center'

	const id = window.requestAnimationFrame(() => gameAnimation(game, canvas))
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
        game.player1.sprite.image = player1.image;
        game.player2.sprite.image = player2.image;
        game.ball = ball;
    }catch(e) {
        console.error("ERREUR CHARGEMENT IMAGES", e);
    }
}


// ============================================================================
// FONCTIONS DU JEU SNAKE - FRONTEND
// ============================================================================

/**
 * Lance une partie de Snake en mode local (2 joueurs, 1 clavier)
 *
 * @description Flux de lancement :
 *   1. Récupère le token JWT et l'ID utilisateur depuis sessionStorage
 *   2. Envoie une requête HTTP GET au serveur second_game (/local)
 *   3. Reçoit l'état initial de la partie (serpents spawnés)
 *   4. Crée une instance SnakeGame côté client
 *   5. Lance la boucle de jeu (WebSocket + rendu)
 *
 * MODE LOCAL :
 *   - 2 joueurs sur le même clavier
 *   - Joueur 1 : touches WASD
 *   - Joueur 2 : touches fléchées
 *   - Pas de matchmaking
 */
async function launchSnakeLocalGame() {
	// Récupère les credentials depuis le session storage
	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");

	// Vérifie que l'utilisateur est authentifié
	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	try {
		// Requête HTTP pour créer une partie locale
		const res = await fetch(`${snake_route}/local`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,  // Authentification JWT
				"x-user-id": userId                 // ID de l'utilisateur
			},
		});

		// Gestion des erreurs HTTP
		if (!res.ok) {
			const text = await res.text();
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to load Snake game`);
		}

		// Vérifie que la réponse est du JSON
		const contentType = res.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			const text = await res.text();
			console.error(`Server did not return JSON`, text);
			throw new Error(`Server response is not JSON`);
		}

		// Parse l'état initial de la partie
		const gameData = await res.json();
		const game = new SnakeGame(gameData);  // Crée l'instance locale

		// Stocke le mode pour le replay
		currentSnakeGameMode = 'local';

		// Lance la boucle de jeu (WebSocket + rendu Canvas)
		snakeGameLoop(game);
	} catch (err) {
		console.error(err);
	}
}

/**
 * Lance une partie de Snake en mode remote (en ligne, matchmaking)
 *
 * @description Flux de lancement :
 *   1. Récupère le token JWT et l'ID utilisateur depuis sessionStorage
 *   2. Envoie une requête HTTP GET au serveur second_game (/remote)
 *   3. Matchmaking côté serveur :
 *      - Premier joueur : Crée une partie en attente (Player 1)
 *      - Deuxième joueur : Rejoint la partie existante (Player 2)
 *   4. Reçoit l'état initial de la partie
 *   5. Crée une instance SnakeGame côté client
 *   6. Lance la boucle de jeu (WebSocket + rendu)
 *
 * MODE REMOTE :
 *   - Chaque joueur sur son propre appareil
 *   - Joueur 1 : touches WASD
 *   - Joueur 2 : touches fléchées
 *   - Résultats sauvegardés dans le service users
 */
async function launchSnakeRemoteGame() {
	// Récupère les credentials depuis le session storage
	const token: string | null = sessionStorage.getItem("jwt");
	const userId: string | null = sessionStorage.getItem("userId");

	// Vérifie que l'utilisateur est authentifié
	if (userId === null || token === null) {
		console.error('Could not fetch user id/token');
		return;
	}

	try {
		// Requête HTTP pour créer/rejoindre une partie remote
		const res = await fetch(`${snake_route}/remote`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,  // Authentification JWT
				"x-user-id": userId                 // Utilisé pour le matchmaking
			},
		});

		// Gestion des erreurs HTTP
		if (!res.ok) {
			const text = await res.text();
			console.error(`Server error ${res.status}:`, text);
			throw new Error(`Failed to load Snake game`);
		}

		// Vérifie que la réponse est du JSON
		const contentType = res.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			const text = await res.text();
			console.error(`Server did not return JSON`, text);
			throw new Error(`Server response is not JSON`);
		}

		// Parse l'état initial de la partie
		const gameData = await res.json();
		const game = new SnakeGame(gameData);  // Crée l'instance locale

		// Stocke le mode pour le replay
		currentSnakeGameMode = 'remote';

		// Lance la boucle de jeu (WebSocket + rendu Canvas)
		snakeGameLoop(game);
	} catch (err) {
		console.error(err);
	}
}

/**
 * Relance une partie de Snake dans le même mode que la partie précédente
 *
 * @description Fonction de replay qui :
 *   1. Vérifie qu'une partie a déjà été jouée (currentSnakeGameMode défini)
 *   2. Nettoie l'état de la partie précédente (WebSocket, canvas, bouton)
 *   3. Relance une nouvelle partie dans le même mode (local ou remote)
 *
 * NETTOYAGE :
 *   - Ferme la connexion WebSocket si elle existe
 *   - Cache le bouton replay
 *   - Efface le canvas
 *
 * RELANCEMENT :
 *   - Mode local : Lance launchSnakeLocalGame()
 *   - Mode remote : Lance launchSnakeRemoteGame()
 */
async function replaySnakeGame() {
	// Vérifie qu'un mode de jeu a été défini
	if (!currentSnakeGameMode) {
		console.error('No previous game mode found');
		return;
	}

	// Nettoie l'état de la partie précédente
	cleanupSnakeGame();

	// Relance une nouvelle partie dans le même mode
	if (currentSnakeGameMode === 'local') {
		await launchSnakeLocalGame();
	} else if (currentSnakeGameMode === 'remote') {
		await launchSnakeRemoteGame();
	}
}

/**
 * Nettoie l'état de la partie Snake précédente
 *
 * @description Fonction de nettoyage qui :
 *   1. Ferme la connexion WebSocket si elle est ouverte
 *   2. Annule l'animation en cours
 *   3. Cache le bouton replay
 *   4. Efface le canvas
 *
 * Appelée avant de lancer une nouvelle partie (replay)
 */
function cleanupSnakeGame() {
	// Ferme la connexion WebSocket si elle existe
	if (currentWebSocket && currentWebSocket.readyState === WebSocket.OPEN) {
		currentWebSocket.close();
		currentWebSocket = null;
	}

	// Annule l'animation en cours
	if (currentAnimationId !== null) {
		cancelAnimationFrame(currentAnimationId);
		currentAnimationId = null;
	}

	// Cache le bouton replay
	const replayButton = document.getElementById("snakeReplayButton") as HTMLButtonElement;
	if (replayButton) {
		replayButton.classList.add('hidden');
	}

	// Efface le canvas
	const canvas = document.getElementById("snakeCanvas") as HTMLCanvasElement;
	const ctx = canvas?.getContext('2d');
	if (ctx && canvas) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
}

/**
 * Boucle de jeu côté client - Gère WebSocket et inputs clavier
 *
 * @param {SnakeGame} game - Instance de la partie (état initial du serveur)
 *
 * @description Cette fonction orchestre 3 éléments principaux :
 *
 *   1. CONNEXION WEBSOCKET
 *      - Établit une connexion WebSocket au serveur second_game
 *      - Envoie "Init" pour s'associer à la partie
 *      - Écoute les mises à jour d'état du serveur
 *
 *   2. GESTION DES INPUTS CLAVIER
 *      - Joueur 1 (WASD) : W=haut, S=bas, A=gauche, D=droite
 *      - Joueur 2 (Flèches) : ↑=haut, ↓=bas, ←=gauche, →=droite
 *      - Les inputs mettent à jour `nextDirection` localement
 *      - Envoi immédiat au serveur via WebSocket (message "input")
 *      - Le serveur valide et applique les changements de direction
 *
 *   3. RENDU CANVAS
 *      - Lance snakeAnimation() après connexion WebSocket établie
 *      - Boucle de rendu à 60 FPS (requestAnimationFrame)
 *
 * SYNCHRONISATION :
 *   - Le serveur est la source de vérité (architecture autoritaire)
 *   - Le client envoie seulement les inputs
 *   - Le serveur calcule tout (mouvement, collisions, wrap-around)
 *   - Le client reçoit l'état mis à jour et l'affiche
 *
 * NETTOYAGE :
 *   - Supprime les event listeners à la fin de la partie
 *   - Ferme proprement la connexion WebSocket
 */
async function snakeGameLoop(game: SnakeGame) {
	try {
		// Établit la connexion WebSocket au serveur
		const ws = new WebSocket(`wss${snake_ws_route}/ws`);
		game.socket = ws;
		currentWebSocket = ws;  // Stocke pour le nettoyage

		// === GESTIONNAIRE D'INPUTS CLAVIER ===
		const keydownHandler = (e: KeyboardEvent) => {
			// Empêche le scroll de la page avec les flèches
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
				e.preventDefault();
			}

			let updated = false;  // Flag pour savoir si on doit envoyer au serveur

			// JOUEUR 1 : Touches WASD (insensible à la casse)
			switch(e.key) {
				case 'w':
				case 'W':
					game.player1.nextDirection = {x: 0, y: -1};  // Haut
					updated = true;
					break;
				case 's':
				case 'S':
					game.player1.nextDirection = {x: 0, y: 1};  // Bas
					updated = true;
					break;
				case 'a':
				case 'A':
					game.player1.nextDirection = {x: -1, y: 0};  // Gauche
					updated = true;
					break;
				case 'd':
				case 'D':
					game.player1.nextDirection = {x: 1, y: 0};  // Droite
					updated = true;
					break;

				// JOUEUR 2 : Touches fléchées
				case 'ArrowUp':
					game.player2.nextDirection = {x: 0, y: -1};  // Haut
					updated = true;
					break;
				case 'ArrowDown':
					game.player2.nextDirection = {x: 0, y: 1};  // Bas
					updated = true;
					break;
				case 'ArrowLeft':
					game.player2.nextDirection = {x: -1, y: 0};  // Gauche
					updated = true;
					break;
				case 'ArrowRight':
					game.player2.nextDirection = {x: 1, y: 0};  // Droite
					updated = true;
					break;
			}

			// Si une direction a été modifiée, envoie au serveur
			if (updated && ws.readyState === WebSocket.OPEN) {
				// Envoie seulement l'ID et les directions des joueurs
				// Évite d'envoyer l'objet game complet (problème de sérialisation WebSocket)
				ws.send(JSON.stringify({
					game: {
						id: game.id,
						player1: { nextDirection: game.player1.nextDirection },
						player2: { nextDirection: game.player2.nextDirection }
					},
					message: "input"
				}));
			}
		};

		// Attache le gestionnaire d'événements clavier
		window.addEventListener('keydown', keydownHandler);

		// Fonction de nettoyage (appelée en fin de partie)
		const cleanup = () => {
			window.removeEventListener('keydown', keydownHandler);
		};

		// === EVENT LISTENERS WEBSOCKET ===

		// OPEN : Connexion établie
		ws.addEventListener('open', () => {
			if (ws.readyState === WebSocket.OPEN) {
				// Envoie le message d'initialisation au serveur
				// Note : On envoie seulement l'ID du jeu, pas l'objet complet
				// car game.socket (WebSocket) n'est pas sérialisable en JSON
				ws.send(JSON.stringify({game: {id: game.id}, message: "Init"}));
			}
			// IMPORTANT : Démarre le rendu seulement APRÈS connexion établie
			// Fix de la race condition où le rendu démarrait avant l'envoi de "Init"
			snakeAnimation(game);
		});

		// MESSAGE : Réception d'un état mis à jour du serveur
		ws.addEventListener('message', (event) => {
			// Parse l'état du jeu envoyé par le serveur
			const serverGame = JSON.parse(event.data);

			// Met à jour l'état local avec les données du serveur
			game.updateFromServer(serverGame);

			// Si la partie est terminée, affiche le bouton replay
			if (game.message === "END") {
				// Affiche le bouton replay immédiatement
				const replayButton = document.getElementById("snakeReplayButton") as HTMLButtonElement;
				if (replayButton) {
					replayButton.classList.remove('hidden');
				}

				setTimeout(cleanup, 2000);
			}
		});

		// ERROR : Erreur WebSocket
		ws.addEventListener('error', (error) => {
			console.error('WebSocket error:', error);
			cleanup();  // Nettoie en cas d'erreur
		});

		// CLOSE : Fermeture de la connexion
		ws.addEventListener('close', () => {
			console.log('WebSocket connection closed');
			cleanup();  // Nettoie à la fermeture
		});
	} catch (error) {
		console.error(error);
	}
}

/**
 * Calcule la position interpolée entre deux positions de grille
 *
 * @param {GridPosition} current - Position actuelle (cible)
 * @param {GridPosition} previous - Position précédente (origine)
 * @param {number} alpha - Facteur d'interpolation (0 à 1)
 * @param {number} gridWidth - Largeur de la grille (pour détecter le wrap-around)
 * @param {number} gridHeight - Hauteur de la grille (pour détecter le wrap-around)
 * @returns {{x: number, y: number}} Position interpolée (peut être décimale)
 *
 * @description Interpole linéairement entre deux positions :
 *   - alpha = 0 : retourne la position précédente
 *   - alpha = 1 : retourne la position actuelle
 *   - alpha = 0.5 : retourne la position au milieu
 *
 * GESTION DU WRAP-AROUND :
 *   Détecte quand un segment a traversé un bord (téléportation)
 *   Ex : Si le serpent passe de x=29 à x=0 (bord droit → bord gauche)
 *   Au lieu d'interpoler 29 → 0 (recul de 29 cellules)
 *   On interpole 29 → 30 (avance d'1 cellule) avec modulo
 */
function getInterpolatedPosition(
	current: GridPosition,
	previous: GridPosition,
	alpha: number,
	gridWidth: number,
	gridHeight: number
): {x: number, y: number} {
	// Calcule la différence de position
	let dx = current.x - previous.x;
	let dy = current.y - previous.y;

	// DÉTECTION DU WRAP-AROUND HORIZONTAL
	// Si la différence est > la moitié de la grille, c'est un wrap-around
	if (Math.abs(dx) > gridWidth / 2) {
		// Ajuste la direction pour interpoler "dans le bon sens"
		dx = dx > 0 ? dx - gridWidth : dx + gridWidth;
	}

	// DÉTECTION DU WRAP-AROUND VERTICAL
	if (Math.abs(dy) > gridHeight / 2) {
		dy = dy > 0 ? dy - gridHeight : dy + gridHeight;
	}

	// Interpole linéairement
	let interpX = previous.x + dx * alpha;
	let interpY = previous.y + dy * alpha;

	// Applique le modulo pour rester dans la grille (gère le wrap-around)
	if (interpX < 0) interpX += gridWidth;
	if (interpX >= gridWidth) interpX -= gridWidth;
	if (interpY < 0) interpY += gridHeight;
	if (interpY >= gridHeight) interpY -= gridHeight;

	return {x: interpX, y: interpY};
}

/**
 * Boucle de rendu Canvas - Affiche le jeu Snake à 60 FPS
 *
 * @param {SnakeGame} game - Instance de la partie (mise à jour via WebSocket)
 *
 * @description Système de rendu en 5 couches (ordre de dessin) :
 *
 *   1. FOND NOIR
 *      - Efface le canvas à chaque frame
 *
 *   2. GRILLE
 *      - Lignes grises subtiles (#1a1a1a) pour visualiser les cellules
 *      - Espacement : cellSize pixels (20px par défaut)
 *
 *   3. SERPENTS
 *      - Joueur 1 : Couleur verte (#7ed27eff)
 *      - Joueur 2 : Couleur rose (#cd6bb3ff)
 *      - Tête : Opacité 100% (alpha = 1.0) - Plus visible
 *      - Corps : Opacité 80% (alpha = 0.8) - Légèrement transparent
 *      - Effet de gap : padding de 1px entre les segments
 *
 *   4. SCORES
 *      - Format : "Nom du joueur: Longueur du serpent"
 *      - Position : En haut du canvas
 *      - Joueur 1 : 1/4 de la largeur
 *      - Joueur 2 : 3/4 de la largeur
 *
 *   5. MESSAGES D'ÉTAT
 *      - "Countdown" : Affiche 3, 2, 1, GO!
 *      - "Waiting" : "Waiting for opponent..." (mode remote)
 *      - "END" : Affiche le gagnant et arrête le rendu
 *
 * PERFORMANCE :
 *   - Utilise requestAnimationFrame pour un rendu fluide à 60 FPS
 *   - Le serveur envoie des updates à ~3.3 FPS (300ms)
 *   - Le rendu interpole visuellement (affiche le dernier état connu)
 *
 * ARRÊT :
 *   - Quand game.message === "END", annule l'animation et sort
 */
function snakeAnimation(game: SnakeGame) {
	// Récupère le canvas HTML et son contexte 2D
	const canvas = document.getElementById("snakeCanvas") as HTMLCanvasElement;
	const ctx = canvas.getContext('2d');

	// Vérification de disponibilité
	if (!ctx || !canvas) {
		console.error('Could not fetch snake canvas or context');
		return;
	}

	// Affiche le canvas (retire la classe 'hidden')
	canvas.classList.remove('hidden');

	// Configure la taille du canvas selon la grille
	// Ex: 30 cellules × 20 pixels = 600×600px
	canvas.width = game.grid.width * game.grid.cellSize;
	canvas.height = game.grid.height * game.grid.cellSize;

	// ID de l'animation pour pouvoir l'annuler
	let animationId: number;

	// === FONCTION DE RENDU (appelée à ~60 FPS) ===
	const render = () => {
		// Stocke l'ID pour le nettoyage global
		if (animationId) {
			currentAnimationId = animationId;
		}

		// CALCUL DU FACTEUR D'INTERPOLATION (alpha)
		// alpha = progression entre la dernière mise à jour serveur et maintenant
		// 0.0 = juste après une mise à jour, 1.0 = juste avant la prochaine
		const now = performance.now();
		const timeSinceUpdate1 = now - game.player1.lastUpdateTime;
		const timeSinceUpdate2 = now - game.player2.lastUpdateTime;
		const TICK_RATE = 300; // Serveur envoie des updates toutes les 300ms
		const alpha1 = Math.min(timeSinceUpdate1 / TICK_RATE, 1.0);
		const alpha2 = Math.min(timeSinceUpdate2 / TICK_RATE, 1.0);

		// COUCHE 1 : FOND NOIR
		// Efface tout le canvas
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// COUCHE 2 : GRILLE
		// Lignes verticales
		ctx.strokeStyle = '#1a1a1a';  // Gris très sombre (subtil)
		ctx.lineWidth = 1;
		for (let x = 0; x <= game.grid.width; x++) {
			ctx.beginPath();
			ctx.moveTo(x * game.grid.cellSize, 0);
			ctx.lineTo(x * game.grid.cellSize, canvas.height);
			ctx.stroke();
		}
		// Lignes horizontales
		for (let y = 0; y <= game.grid.height; y++) {
			ctx.beginPath();
			ctx.moveTo(0, y * game.grid.cellSize);
			ctx.lineTo(canvas.width, y * game.grid.cellSize);
			ctx.stroke();
		}

		// COUCHE 3A : SERPENT JOUEUR 1 (avec interpolation et segments continus)
		if (game.player1.snake && game.player1.snake.length > 0) {
			// Tableau des positions interpolées
			const interpolatedPositions: {x: number, y: number}[] = [];

			// Calcul des positions interpolées pour tous les segments
			game.player1.snake.forEach((segment, index) => {
				let drawX = segment.x;
				let drawY = segment.y;

				// INTERPOLATION : si on a une position précédente pour ce segment
				if (game.player1.previousSnake &&
					game.player1.previousSnake.length > index &&
					game.message === "Playing") {

					const prevSegment = game.player1.previousSnake[index];
					const interpolated = getInterpolatedPosition(
						segment,
						prevSegment,
						alpha1,
						game.grid.width,
						game.grid.height
					);
					drawX = interpolated.x;
					drawY = interpolated.y;
				}

				interpolatedPositions.push({x: drawX, y: drawY});
			});

			// Dessin du serpent avec segments séparés (gaps)
			interpolatedPositions.forEach((pos, index) => {
				// Opacité : tête = 100%, corps = 80%
				const opacity = index === 0 ? 1 : 1;
				ctx.globalAlpha = opacity;
				ctx.fillStyle = game.player1.color;

				// Dessine le segment avec gap de 1px
				ctx.fillRect(
					pos.x * game.grid.cellSize + 1,
					pos.y * game.grid.cellSize + 1,
					game.grid.cellSize - 2,
					game.grid.cellSize - 2
				);

				// Dessine les yeux sur la tête
				if (index === 0) {
					ctx.globalAlpha = 1;
					ctx.fillStyle = '#000000'; // Yeux noirs

					// Direction du regard basée sur la direction du serpent
					const direction = game.player1.direction;

					// Taille des yeux
					const eyeSize = game.grid.cellSize / 8;
					const centerX = pos.x * game.grid.cellSize + game.grid.cellSize / 2;
					const centerY = pos.y * game.grid.cellSize + game.grid.cellSize / 2;

					// Position des yeux selon la direction
					let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;

					if (direction.x === 1) { // Droite
						eye1X = centerX + game.grid.cellSize / 4;
						eye1Y = centerY - game.grid.cellSize / 4;
						eye2X = centerX + game.grid.cellSize / 4;
						eye2Y = centerY + game.grid.cellSize / 4;
					} else if (direction.x === -1) { // Gauche
						eye1X = centerX - game.grid.cellSize / 4;
						eye1Y = centerY - game.grid.cellSize / 4;
						eye2X = centerX - game.grid.cellSize / 4;
						eye2Y = centerY + game.grid.cellSize / 4;
					} else if (direction.y === -1) { // Haut
						eye1X = centerX - game.grid.cellSize / 4;
						eye1Y = centerY - game.grid.cellSize / 4;
						eye2X = centerX + game.grid.cellSize / 4;
						eye2Y = centerY - game.grid.cellSize / 4;
					} else { // Bas ou défaut
						eye1X = centerX - game.grid.cellSize / 4;
						eye1Y = centerY + game.grid.cellSize / 4;
						eye2X = centerX + game.grid.cellSize / 4;
						eye2Y = centerY + game.grid.cellSize / 4;
					}

					// Dessine les yeux
					ctx.beginPath();
					ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
					ctx.fill();

					ctx.beginPath();
					ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
					ctx.fill();
				}
			});
		}

		// COUCHE 3B : SERPENT JOUEUR 2 (avec interpolation et segments continus)
		if (game.player2.snake && game.player2.snake.length > 0) {
			// Tableau des positions interpolées
			const interpolatedPositions: {x: number, y: number}[] = [];

			// Calcul des positions interpolées pour tous les segments
			game.player2.snake.forEach((segment, index) => {
				let drawX = segment.x;
				let drawY = segment.y;

				// INTERPOLATION : si on a une position précédente pour ce segment
				if (game.player2.previousSnake &&
					game.player2.previousSnake.length > index &&
					game.message === "Playing") {

					const prevSegment = game.player2.previousSnake[index];
					const interpolated = getInterpolatedPosition(
						segment,
						prevSegment,
						alpha2,
						game.grid.width,
						game.grid.height
					);
					drawX = interpolated.x;
					drawY = interpolated.y;
				}

				interpolatedPositions.push({x: drawX, y: drawY});
			});

			// Dessin du serpent avec segments séparés (gaps)
			interpolatedPositions.forEach((pos, index) => {
				// Opacité : tête = 100%, corps = 100%
				const opacity = index === 0 ? 1 : 1;
				ctx.globalAlpha = opacity;
				ctx.fillStyle = game.player2.color;

				// Dessine le segment avec gap de 1px
				ctx.fillRect(
					pos.x * game.grid.cellSize + 1,
					pos.y * game.grid.cellSize + 1,
					game.grid.cellSize - 2,
					game.grid.cellSize - 2
				);

				// Dessine les yeux sur la tête
				if (index === 0) {
					ctx.globalAlpha = 1;
					ctx.fillStyle = '#000000'; // Yeux noirs

					// Direction du regard basée sur la direction du serpent
					const direction = game.player2.direction;

					// Taille des yeux
					const eyeSize = game.grid.cellSize / 8;
					const centerX = pos.x * game.grid.cellSize + game.grid.cellSize / 2;
					const centerY = pos.y * game.grid.cellSize + game.grid.cellSize / 2;

					// Position des yeux selon la direction
					let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;

					if (direction.x === 1) { // Droite
						eye1X = centerX + game.grid.cellSize / 4;
						eye1Y = centerY - game.grid.cellSize / 4;
						eye2X = centerX + game.grid.cellSize / 4;
						eye2Y = centerY + game.grid.cellSize / 4;
					} else if (direction.x === -1) { // Gauche
						eye1X = centerX - game.grid.cellSize / 4;
						eye1Y = centerY - game.grid.cellSize / 4;
						eye2X = centerX - game.grid.cellSize / 4;
						eye2Y = centerY + game.grid.cellSize / 4;
					} else if (direction.y === -1) { // Haut
						eye1X = centerX - game.grid.cellSize / 4;
						eye1Y = centerY - game.grid.cellSize / 4;
						eye2X = centerX + game.grid.cellSize / 4;
						eye2Y = centerY - game.grid.cellSize / 4;
					} else { // Bas ou défaut
						eye1X = centerX - game.grid.cellSize / 4;
						eye1Y = centerY + game.grid.cellSize / 4;
						eye2X = centerX + game.grid.cellSize / 4;
						eye2Y = centerY + game.grid.cellSize / 4;
					}

					// Dessine les yeux
					ctx.beginPath();
					ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
					ctx.fill();

					ctx.beginPath();
					ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
					ctx.fill();
				}
			});
		}

		// Réinitialise l'opacité pour le texte
		ctx.globalAlpha = 1;

		// COUCHE 4 : SCORES
		ctx.fillStyle = '#FFFFFF';  // Texte blanc
		ctx.font = '24px Arial';
		ctx.textAlign = 'center';

		// Score Joueur 1 (à gauche)
		ctx.fillText(
			`${game.player1.name || 'Player 1'}: ${game.player1.snake.length}`,
			canvas.width / 4,
			30
		);

		// Score Joueur 2 (à droite)
		ctx.fillText(
			`${game.player2.name || 'Player 2'}: ${game.player2.snake.length}`,
			(canvas.width * 3) / 4,
			30
		);

		// COUCHE 5 : MESSAGES D'ÉTAT
		// Affichés au centre du canvas

		// COUNTDOWN : 3, 2, 1, GO!
		if (game.message === "Countdown") {
			ctx.font = '48px Arial';
			ctx.fillText(
				game.timer === 0 ? "GO!" : game.timer.toString(),
				canvas.width / 2,
				canvas.height / 2
			);
		}
		// WAITING : En attente d'adversaire (mode remote)
		else if (game.message === "Waiting") {
			ctx.font = '36px Arial';
			ctx.fillText(
				"Waiting for opponent...",
				canvas.width / 2,
				canvas.height / 2
			);
		}
		// END : Partie terminée, affiche le gagnant
		else if (game.message === "END") {
			ctx.font = '36px Arial';
			ctx.fillText(game.displayWinner, canvas.width / 2, canvas.height / 2);

			// ARRÊTE LA BOUCLE DE RENDU
			if (animationId) cancelAnimationFrame(animationId);
			return;  // Sort de la fonction
		}

		// Planifie la prochaine frame (~60 FPS)
		animationId = requestAnimationFrame(render);
	};

	// Démarre la boucle de rendu
	render();
}
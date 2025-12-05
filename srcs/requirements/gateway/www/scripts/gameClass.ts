export interface Vector2D {
	x:	number;
	y:	number;
}

export interface KeyBind {
	up:		boolean | undefined;
	down:	boolean | undefined;
}

export interface ImgSize {
	height:	number;
	width:	number;
}

export class Sprite {
	position:	Vector2D;
	velocity:	Vector2D;
	image:		HTMLImageElement;
	imgSize:	ImgSize;
	key:		KeyBind;
	score:		number | undefined;
	loaded:		boolean;

    constructor({position, velocity, imageSrc, imgSize, key, score}: { position: Vector2D, velocity: Vector2D, imageSrc: string, imgSize: ImgSize, key: KeyBind, score: number | undefined}) {
        this.position = position
        this.velocity = velocity
        this.image = new Image()
        this.image.src = imageSrc
		this.imgSize = imgSize;
        this.key = key
        this.score = score
        this.loaded = false
    }
}


export class Game {
	id:				number;
	socket:			WebSocket;
	mode:			string;
	message:		string;
	winner:			string;
	displayWinner:	string;

	player1:	Sprite;
	player2:	Sprite;
	ball:		Sprite;
	board:		Sprite;

    constructor({id, socket, mode}: { id: number, socket: WebSocket, mode: string}) {
        this.id = id
        this.socket = socket
        this.mode = mode
        this.message = "";
		this.winner = "";
		this.displayWinner = "";

		this.player1 = new Sprite({
			position: { x: 0 , y: 0 },
			velocity: { x: 0, y: 0 },
			imageSrc: "./assets/pong/Player.png",
			imgSize: { height: 0 , width: 0 },
			key: { up: false , down: false },
			score: 0
		});
		this.player2 = new Sprite({
			position: { x: 0 , y: 0 },
			velocity: { x: 0, y: 0 },
			imageSrc: "./assets/pong/Player2.png",
			imgSize: { height: 0 , width: 0 },
			key: { up: false , down: false },
			score: 0
		});
		this.ball = new Sprite({
			position: { x: 0 , y: 0 },
			velocity: { x: 0, y: 0 },
			imageSrc: "./assets/pong/Ball.png",
			imgSize: { height: 0 , width: 0 },
			key: { up: false , down: false },
			score: 0
		})
		this.board = new Sprite({
			position: { x: 0 , y: 0 },
			velocity: { x: 0, y: 0 },
			imageSrc: "./assets/pong/Board.png",
			imgSize: { height: 0 , width: 0 },
			key: { up: false , down: false },
			score: 0
		})
    }
}
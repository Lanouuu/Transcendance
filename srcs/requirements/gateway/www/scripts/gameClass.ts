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
	loaded:		boolean;

    constructor({position, velocity, imageSrc, imgSize}: { position: Vector2D, velocity: Vector2D, imageSrc: string, imgSize: ImgSize}) {
        this.position = position
        this.velocity = velocity
        this.image = new Image()
        this.image.src = imageSrc
		this.imgSize = imgSize;
        this.loaded = false
    }
}

export class Player {
	name:		string | undefined; 
	key:		KeyBind;
	score:		number | undefined;
	sprite:		Sprite;

	constructor({name, key, score, sprite}: { name: string | undefined, key: KeyBind, score: number | undefined, sprite: Sprite}) {
		this.name = name;
		this.key = key;
		this.score = score;
		this.sprite = sprite;
	}
}

export class Game {
	id:				number;
	socket:			WebSocket;
	mode:			string;
	message:		string;
	winner:			string;
	displayWinner:	string;
	started:		boolean;
	timer:			number;
	timerStarted:	boolean;

	player1:	Player;
	player2:	Player;
	ball:		Sprite;
	board:		Sprite;

    constructor({id, socket, mode}: { id: number, socket: WebSocket, mode: string}) {
        this.id = id
        this.socket = socket
        this.mode = mode
        this.message = "";
		this.winner = "";
		this.displayWinner = "";
		this.started = false;
		this.timer = 3;
		this.timerStarted = false;

		this.player1 = new Player({
			name: undefined,
			key: { up: false , down: false },
			score: 0,
			sprite: undefined as unknown as Sprite
		});
		this.player2 = new Player({
			name: undefined,
			key: { up: false , down: false },
			score: 0,
			sprite: undefined as unknown as Sprite
		});
		this.ball = undefined as unknown as Sprite;
		this.board = undefined as unknown as Sprite;
    }
}
/**
 * Position sur la grille de jeu (coordonnées de cellule)
 * @interface GridPosition
 * @property {number} x - Coordonnée X (0 à width-1)
 * @property {number} y - Coordonnée Y (0 à height-1)
 */
export interface GridPosition {
    x: number;
    y: number;
}

/**
 * Vecteur de direction de déplacement
 * @interface Direction
 * @property {number} x - Déplacement horizontal (-1=gauche, 0=aucun, 1=droite)
 * @property {number} y - Déplacement vertical (-1=haut, 0=aucun, 1=bas)
 */
export interface Direction {
    x: number;
    y: number;
}

/**
 * Configuration de la grille de jeu
 * @interface Grid
 * @property {number} width - Largeur en nombre de cellules (30)
 * @property {number} height - Hauteur en nombre de cellules (30)
 * @property {number} cellSize - Taille d'une cellule en pixels (20)
 */
export interface Grid {
    width: number;
    height: number;
    cellSize: number;
}

/**
 * Représente un joueur et son serpent dans la partie
 * @class SnakePlayer
 * @description Contient toutes les données d'un joueur :
 *   - Identité (nom, ID)
 *   - Serpent (positions de tous les segments)
 *   - Déplacement (direction actuelle et direction demandée)
 *   - État (vivant/mort, couleur)
 */
export class SnakePlayer {
    name: string | undefined;          // Nom du joueur (récupéré du service users)
    id: number | undefined;            // ID utilisateur
    snake: GridPosition[];             // Array des segments du serpent (index 0 = tête)
    direction: Direction;              // Direction actuelle de déplacement
    nextDirection: Direction;          // Direction demandée (buffer anti-retour 180°)
    alive: boolean;                    // true = en vie, false = collision
    color: string;                     // Couleur du serpent en hexadécimal (#RRGGBBAA)

    /**
     * Construit un joueur à partir des données serveur
     * @param {any} data - Données du joueur depuis le serveur
     */
    constructor(data: any) {
        this.name = data.name;
        this.id = data.id;
        this.snake = data.snake || [];                                         // Vide au départ
        this.direction = data.direction || {x: 0, y: 0};                      // Immobile au départ
        this.nextDirection = data.nextDirection || {x: 0, y: 0};              // Aucune direction
        this.alive = data.alive !== undefined ? data.alive : true;             // Vivant par défaut
        this.color = data.color || "#00FF00";                                  // Vert par défaut
    }
}

/**
 * État complet d'une partie de Snake côté client
 * @class SnakeGame
 * @description Version frontend de la classe SnakeGame du serveur
 *   Contient une copie locale de l'état du jeu synchronisée via WebSocket
 */
export class SnakeGame {
    id: number;                        // ID unique de la partie
    socket: WebSocket | undefined;     // Connexion WebSocket au serveur
    mode: string;                      // "local" ou "remote"
    message: string;                   // État : "Waiting", "Countdown", "Playing", "END"
    winner: string;                    // "Player1", "Player2", ou "Draw"
    displayWinner: string;             // Message formaté pour affichage
    started: boolean;                  // true quand le jeu a commencé
    timer: number;                     // Countdown en secondes (3, 2, 1)
    timerStarted: boolean;             // Flag pour démarrer le countdown
    tickCount: number;                 // Nombre de ticks écoulés

    grid: Grid;                        // Configuration de la grille

    player1: SnakePlayer;              // Joueur 1 (vert)
    player2: SnakePlayer;              // Joueur 2 (rose)

    /**
     * Construit l'état initial de la partie depuis les données serveur
     * @param {any} data - État initial de la partie depuis HTTP GET /local ou /remote
     */
    constructor(data: any) {
        this.id = data.id;
        this.socket = undefined;                                               // Sera défini dans snakeGameLoop
        this.mode = data.mode;
        this.message = data.message;
        this.winner = data.winner || "";
        this.displayWinner = data.displayWinner || "";
        this.started = data.started || false;
        this.timer = data.timer || 3;
        this.timerStarted = data.timerStarted || false;
        this.tickCount = data.tickCount || 0;

        this.grid = data.grid || {width: 30, height: 30, cellSize: 20};

        this.player1 = new SnakePlayer(data.player1 || {});
        this.player2 = new SnakePlayer(data.player2 || {});
    }

    /**
     * Met à jour l'état local avec les données reçues du serveur via WebSocket
     * @param {any} serverData - Nouvel état du jeu envoyé par le serveur
     *
     * @description Synchronise l'état local avec le serveur (source de vérité)
     *   Appelée à chaque message WebSocket reçu (~300ms)
     *   Met à jour : état de la partie, serpents, timer, gagnant
     */
    updateFromServer(serverData: any) {
        // === État de la partie ===
        this.message = serverData.message;                 // "Countdown", "Playing", "END"
        this.started = serverData.started;                 // Jeu commencé ?
        this.timer = serverData.timer;                     // Countdown (3, 2, 1, 0)
        this.winner = serverData.winner;                   // Gagnant ("Player1", "Player2", "Draw")
        this.displayWinner = serverData.displayWinner;     // Message formaté
        this.tickCount = serverData.tickCount;             // Nombre de ticks

        // === Mise à jour Joueur 1 ===
        if (serverData.player1) {
            this.player1.snake = serverData.player1.snake;           // Nouvelles positions
            this.player1.alive = serverData.player1.alive;           // Statut vivant/mort
            this.player1.direction = serverData.player1.direction;   // Direction actuelle
            this.player1.name = serverData.player1.name;             // Nom (si mis à jour)
        }

        // === Mise à jour Joueur 2 ===
        if (serverData.player2) {
            this.player2.snake = serverData.player2.snake;           // Nouvelles positions
            this.player2.alive = serverData.player2.alive;           // Statut vivant/mort
            this.player2.direction = serverData.player2.direction;   // Direction actuelle
            this.player2.name = serverData.player2.name;             // Nom (si mis à jour)
        }
    }
}

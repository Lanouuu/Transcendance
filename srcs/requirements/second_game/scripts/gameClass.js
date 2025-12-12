/**
 * Classe principale représentant une partie de Snake multijoueur
 * Contient toute la configuration et l'état d'une partie en cours
 *
 * @class SnakeGame
 * @description Cette classe gère l'état complet d'une partie de Snake incluant :
 *   - La grille de jeu (30x30 cellules)
 *   - Les deux joueurs (serpents, directions, statut)
 *   - Le cycle de vie de la partie (countdown, jeu, fin)
 *   - Les connexions WebSocket pour la communication temps réel
 */
export class SnakeGame {
    /**
     * Crée une nouvelle instance de partie Snake
     *
     * @param {Object} config - Configuration initiale de la partie
     * @param {number} config.id - Identifiant unique de la partie
     * @param {Array} config.socket - Array des connexions WebSocket des joueurs
     * @param {string} config.mode - Mode de jeu : "local" (même clavier) ou "remote" (en ligne)
     * @param {string} config.message - État initial : "Waiting", "start", "Countdown", "Playing", "END"
     */
    constructor({id, socket, mode, message}) {
        // === Identifiants ===
        this.id = id  // ID unique de la partie (incrémental)

        // === Connexions réseau ===
        this.socket = socket  // Array de WebSocket connections pour broadcast

        // === Configuration de la partie ===
        this.mode = mode      // "local" : 2 joueurs même clavier | "remote" : 2 joueurs en ligne
        this.message = message // État de la partie : "Waiting", "start", "Countdown", "Playing", "END"

        // === Configuration de la grille ===
        // Grille 30x30 avec cellules de 20px = Canvas de 600x600px
        this.grid = {
            width: 30,         // Nombre de cellules en largeur
            height: 30,        // Nombre de cellules en hauteur
            cellSize: 20       // Taille d'une cellule en pixels (pour le rendu Canvas)
        }

        // === Joueur 1 (Vert) ===
        this.player1 = {
            name: undefined,              // Nom du joueur (récupéré du service users)
            id: undefined,                // ID utilisateur
            snake: [],                    // Array de positions {x, y} - index 0 = tête
            direction: {x: 0, y: 0},     // Direction actuelle du serpent (-1/0/1 pour x et y)
            nextDirection: {x: 0, y: 0}, // Direction demandée (buffer anti-retour 180°)
            alive: true,                  // Statut du serpent (false = collision)
            color: "#7ed27eff"            // Couleur du serpent (vert avec alpha)
        }

        // === Joueur 2 (Rose) ===
        this.player2 = {
            name: undefined,              // Nom du joueur
            id: undefined,                // ID utilisateur
            snake: [],                    // Array de positions {x, y}
            direction: {x: 0, y: 0},     // Direction actuelle
            nextDirection: {x: 0, y: 0}, // Direction demandée (buffer)
            alive: true,                  // Statut du serpent
            color: "#cd6bb3ff"            // Couleur du serpent (rose/rouge avec alpha)
        }

        // === Cycle de vie de la partie ===
        this.winner = ""              // "Player1", "Player2", ou "Draw"
        this.displayWinner = ""       // Message formaté pour l'affichage (ex: "Alice wins!")
        this.started = false          // true quand le countdown est terminé et le jeu commence
        this.timer = 3                // Countdown en secondes avant le début (3, 2, 1, GO!)
        this.timerStarted = false     // Flag pour lancer le countdown une seule fois
        this.loopId = null            // ID du setInterval de la game loop (pour clearInterval)
        this.tickCount = 0            // Nombre de ticks écoulés depuis le début (score temporel)
    }
}

/**
 * ============================================================================
 * SERVEUR SNAKE GAME - BACKEND AUTORITAIRE AVEC WEBSOCKET
 * ============================================================================
 *
 * Ce serveur gère le jeu Snake multijoueur avec architecture client-serveur :
 * - Toute la logique de jeu s'exécute côté serveur (empêche la triche)
 * - Communication temps réel via WebSocket
 * - Support de 2 modes : local (même clavier) et remote (en ligne)
 * - Game loop à 300ms (environ 3.3 ticks/seconde)
 *
 * ROUTES HTTP :
 *   GET /local    - Crée une partie locale (2 joueurs, 1 clavier)
 *   GET /remote   - Crée/rejoint une partie en ligne (matchmaking)
 *   GET /state/:id - Interroge l'état d'une partie
 *
 * WEBSOCKET :
 *   Path: /ws
 *   Messages: "Init" (connexion), "input" (changement de direction)
 */

import Fastify from "fastify";
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { SnakeGame } from './gameClass.js';
import { checkCollisions, determineWinner } from './collision.js';
import { generateRandomSpawn } from './spawn.js';
import fs from 'fs';

/**
 * Fonction principale - Initialise et démarre le serveur Snake
 * @function runServer
 */
export function runServer() {

    // === CONFIGURATION DU SERVEUR FASTIFY ===
    const fastify = Fastify({
        logger: true,                    // Logs détaillés pour debug
        connectionTimeout: 120000,       // Timeout 2 minutes
        keepAliveTimeout: 120000,        // Keep-alive 2 minutes
        https: {
            key: fs.readFileSync('/etc/ssl/transcendence.key'),
            cert: fs.readFileSync('/etc/ssl/transcendence.crt')
        }
    });
    const PORT = parseInt(process.env.SECOND_GAME_PORT, 10);  // Port depuis env
    const HOST = process.env.SECOND_GAME_HOST;                // Host depuis env

    // === ACTIVATION DE CORS ===
    // Permet les requêtes cross-origin depuis le frontend
    fastify.register(cors, {
        origin: true,          // Accepte toutes les origines
        credentials: true      // Autorise les cookies/authentification
    });

    // === GESTION DE L'ÉTAT DES PARTIES ===
    const games = new Map();           // Map(gameId → SnakeGame) - Toutes les parties actives
    let gameId = 0;                     // Compteur incrémental pour les IDs de partie
    let pendingRemoteQueue = [];        // File d'attente pour le matchmaking ELO (mode remote)
                                        // Structure: [{game, userId, userName, elo, timestamp}]

    // ========================================================================
    // FONCTIONS UTILITAIRES
    // ========================================================================

    /**
     * Valide qu'une direction est cardinale (haut/bas/gauche/droite uniquement)
     *
     * @param {Object} direction - Direction à valider {x, y}
     * @returns {boolean} true si direction valide, false sinon
     *
     * @description Vérifie que :
     *   - Les valeurs x et y sont des nombres
     *   - Les valeurs sont -1, 0, ou 1
     *   - Exactement UN axe est activé (pas de diagonale ni d'immobilité)
     *
     * Directions valides :
     *   {x: 1, y: 0}   → Droite
     *   {x: -1, y: 0}  → Gauche
     *   {x: 0, y: 1}   → Bas
     *   {x: 0, y: -1}  → Haut
     *
     * Directions INVALIDES :
     *   {x: 1, y: 1}   → Diagonale (interdit)
     *   {x: 0, y: 0}   → Immobile (interdit)
     *   {x: 2, y: 0}   → Valeur hors plage (interdit)
     */
    function isValidDirection(direction) {
        // Vérification du type
        if (!direction || typeof direction !== 'object') return false;
        if (typeof direction.x !== 'number' || typeof direction.y !== 'number') return false;

        // Vérification des valeurs (seulement -1, 0, ou 1)
        const validValues = [-1, 0, 1];
        if (!validValues.includes(direction.x) || !validValues.includes(direction.y)) return false;

        // Vérification qu'exactement un axe est activé
        // |x| + |y| doit être égal à 1 (pas diagonal, pas stationnaire)
        if (Math.abs(direction.x) + Math.abs(direction.y) !== 1) return false;

        return true;
    }

    /**
     * Récupère le nom d'utilisateur depuis le service users
     *
     * @param {number} userId - ID de l'utilisateur
     * @returns {Promise<string>} Nom d'utilisateur ou "Player {userId}" par défaut
     *
     * @description Fait une requête HTTP au microservice users
     *   En cas d'erreur, retourne un nom par défaut
     */
    async function getUserName(userId) {
        try {
            const response = await fetch(`http://users:3000/get-user/${userId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": userId
                 }
            });
            if (response.ok) {
                const data = await response.json();
                return data.name || `Player ${userId}`;
            }
        } catch (e) {
            console.error("Error fetching username:", e.message);
        }
        return `Player ${userId}`;  // Fallback
    }

    /**
     * Récupère l'ELO Snake d'un utilisateur depuis le service users
     *
     * @param {number} userId - ID de l'utilisateur
     * @returns {Promise<number>} ELO du joueur (défaut: 1200)
     *
     * @description Fait une requête HTTP au microservice users pour récupérer le snake_elo
     *   En cas d'erreur ou si l'ELO n'existe pas, retourne 1200 (ELO de départ)
     */
    async function getUserElo(userId) {
        try {
            const response = await fetch(`http://users:3000/get-user/${userId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": userId
                }
            });
            if (response.ok) {
                const data = await response.json();
                return data.snake_elo || 1200;
            }
        } catch (e) {
            console.error("Error fetching user ELO:", e.message);
        }
        return 1200;  // Fallback
    }

    /**
     * Calcule la tolérance ELO basée sur le temps d'attente
     *
     * @param {number} waitTime - Temps d'attente en millisecondes
     * @returns {number} Tolérance ELO
     *
     * @description Système de tolérance progressive pour garantir qu'un joueur trouve toujours un match:
     *   0-5s:   ±100 ELO (matchs très équilibrés)
     *   5-10s:  ±200 ELO (matchs équilibrés)
     *   10-20s: ±500 ELO (matchs corrects)
     *   >20s:   Infini (accepte n'importe qui)
     */
    function calculateEloTolerance(waitTime) {
        const seconds = waitTime / 1000;

        if (seconds < 5) return 100;
        if (seconds < 10) return 200;
        if (seconds < 20) return 500;
        return Infinity;  // Après 2 minutes, accepte n'importe qui
    }

    /**
     * Trouve le meilleur adversaire pour un joueur dans la file d'attente
     *
     * @param {number} playerElo - ELO du joueur cherchant un match
     * @param {number} tolerance - Tolérance ELO acceptable
     * @param {Array} queue - File d'attente des joueurs
     * @returns {Object|null} Meilleur adversaire trouvé (structure: {game, userId, userName, elo, timestamp}), ou null
     *
     * @description Algorithme d'appairage:
     *   1. Filtre les candidats dont l'ELO est dans la tolérance
     *   2. Parmi les candidats valides, retourne le plus ancien (FIFO)
     *   3. Si aucun candidat valide, retourne null
     */
    function findBestMatch(playerElo, tolerance, queue) {
        if (queue.length === 0) return null;

        // Filtre les candidats dans la tolérance ELO
        const candidates = queue.filter(entry => {
            const eloDiff = Math.abs(entry.elo - playerElo);
            return eloDiff <= tolerance;
        });

        if (candidates.length === 0) return null;

        // Prend le plus ancien (FIFO) parmi les candidats valides
        return candidates[0];
    }

    /**
     * Sérialise l'état du jeu pour transmission JSON via WebSocket
     *
     * @param {SnakeGame} game - Instance de la partie
     * @returns {Object} État du jeu sérialisé (sans WebSocket)
     *
     * @description Crée une copie propre de l'état du jeu en excluant :
     *   - Les objets non sérialisables (WebSocket, setInterval)
     *   - Les références circulaires
     *   Nécessaire car JSON.stringify() ne peut pas gérer ces objets
     */
    function serializeGameState(game) {
        return {
            // État de la partie
            id: game.id,
            mode: game.mode,
            message: game.message,
            winner: game.winner,
            displayWinner: game.displayWinner,
            started: game.started,
            timer: game.timer,
            timerStarted: game.timerStarted,
            tickCount: game.tickCount,
            grid: game.grid,

            // Joueur 1
            player1: {
                name: game.player1.name,
                id: game.player1.id,
                snake: game.player1.snake,
                direction: game.player1.direction,
                nextDirection: game.player1.nextDirection,
                alive: game.player1.alive,
                color: game.player1.color
            },

            // Joueur 2
            player2: {
                name: game.player2.name,
                id: game.player2.id,
                snake: game.player2.snake,
                direction: game.player2.direction,
                nextDirection: game.player2.nextDirection,
                alive: game.player2.alive,
                color: game.player2.color
            }
        };
    }

    /**
     * Envoie les résultats de la partie au service users (mode remote uniquement)
     *
     * @param {SnakeGame} game - Partie terminée
     *
     * @description Sauvegarde les statistiques de la partie :
     *   - IDs des joueurs
     *   - ID du gagnant (null si draw)
     *   - Scores (longueur des serpents)
     *   - Type de match : "snake_remote"
     *
     * Endpoint : POST http://users:3000/save-match
     */
    async function sendResult(game) {
        try {
            // Détermine l'ID du gagnant
            let winnerID = 0;
            if (game.winner === "Player1") {
                winnerID = game.player1.id;
            } else if (game.winner === "Player2") {
                winnerID = game.player2.id;
            }
            // Si draw : winnerID reste null

            // Prépare les données du match
            const matchData = {
                player1ID: game.player1.id,
                player2ID: game.player2.id,
                winnerID: winnerID,
                scoreP1: game.player1.snake.length,  // Score = longueur du serpent
                scoreP2: game.player2.snake.length,
                matchType: "remote",
                gameType: "snake"
            };

            // Envoie au service users
            const response = await fetch("http://users:3000/save-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(matchData)
            });

            if (!response.ok) {
                console.error("Failed to save match result");
            }
        } catch (e) {
            console.error("Error sending result:", e.message);
        }
    }

    /**
     * Démarre le compte à rebours de 3 secondes avant le début de la partie
     *
     * @param {SnakeGame} game - Partie à démarrer
     *
     * @description Lance un interval de 1 seconde qui :
     *   1. Décrémente le timer (3 → 2 → 1 → 0)
     *   2. Broadcast l'état à chaque seconde
     *   3. Au timer 0 : passe en mode "Playing" et arrête l'interval
     *
     * États diffusés :
     *   - timer 3, 2, 1 : message = "Countdown"
     *   - timer 0 : message = "Playing", started = true
     */
    function startTimer(game) {
        const timerInterval = setInterval(() => {
            if (game.timer > 0) {
                // Pendant le countdown
                game.message = "Countdown";
                game.timer--;  // 3 → 2 → 1

                // Diffuse la mise à jour du timer
                game.socket.forEach(socket => {
                    if (socket.readyState === 1) {  // 1 = OPEN
                        socket.send(JSON.stringify(serializeGameState(game)));
                    }
                });
            } else {
                // Countdown terminé : démarre le jeu
                game.message = "Playing";
                game.started = true;
                clearInterval(timerInterval);  // Arrête le countdown

                // Diffuse le début de la partie
                game.socket.forEach(socket => {
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify(serializeGameState(game)));
                    }
                });
            }
        }, 1000);  // Interval de 1 seconde
    }

    /**
     * Met à jour la direction du serpent avec validation anti-retour 180°
     *
     * @param {Object} player - Joueur (player1 ou player2)
     * @param {number} gridWidth - Largeur de la grille (pour wrap-around)
     * @param {number} gridHeight - Hauteur de la grille (pour wrap-around)
     *
     * @description Système de buffer de direction :
     *   - nextDirection : Direction demandée par le joueur (input)
     *   - direction : Direction actuelle du serpent
     *
     * Validation anti-retour :
     *   - Vérifie que la nouvelle direction ne ferait pas entrer la tête
     *     en collision avec le cou (retour 180° instantané)
     *   - Exemple : Si le serpent va à droite →, interdire de tourner à gauche ←
     *   - IMPORTANT : Tient compte du wrap-around (téléportation aux bords)
     *   - Si valide : direction = nextDirection
     */
    function updateSnakeDirection(player, gridWidth, gridHeight) {
        if (!player.snake || player.snake.length === 0) return;

        const head = player.snake[0];  // Tête actuelle
        const neck = player.snake[1];  // Cou (segment suivant)

        // Vérifie si une nouvelle direction est demandée
        if (player.nextDirection.x !== 0 || player.nextDirection.y !== 0) {
            // Calcule où serait la tête avec la nouvelle direction
            let newHeadX = head.x + player.nextDirection.x;
            let newHeadY = head.y + player.nextDirection.y;

            // Applique le wrap-around pour calculer la vraie position finale
            if (newHeadX < 0) {
                newHeadX = gridWidth - 1;
            } else if (newHeadX >= gridWidth) {
                newHeadX = 0;
            }
            if (newHeadY < 0) {
                newHeadY = gridHeight - 1;
            } else if (newHeadY >= gridHeight) {
                newHeadY = 0;
            }

            // Vérifie si cette position finale coïncide avec le cou
            // Cela détecte correctement les retours à 180° même après wrap-around
            const wouldReverse = neck &&
                (newHeadX === neck.x) &&
                (newHeadY === neck.y);

            if (!wouldReverse) {
                // Direction valide : applique le changement
                player.direction = {...player.nextDirection};
            }
            // Si wouldReverse : ignore la nouvelle direction (garde l'ancienne)
        }
    }

    /**
     * Déplace le serpent d'un joueur avec système de wrap-around (téléportation)
     *
     * @param {Object} player - Joueur (player1 ou player2)
     * @param {number} gridWidth - Largeur de la grille
     * @param {number} gridHeight - Hauteur de la grille
     * @param {number} tickCount - Nombre de ticks écoulés depuis le début
     *
     * @description Déplacement en 3 étapes :
     *
     *   ÉTAPE 1 : Calcul de la nouvelle position de la tête
     *   - Position = tête actuelle + vecteur de direction
     *   - Applique le wrap-around si sortie de la grille
     *
     *   ÉTAPE 2 : Ajout de la nouvelle tête
     *   - Ajoute la nouvelle tête au début du serpent (index 0)
     *
     *   ÉTAPE 3 : Gestion de la croissance
     *   - Le serpent grandit tous les 4 ticks (tick % 4 === 0)
     *   - Entre-temps, supprime la queue pour maintenir la longueur (pop())
     *
     * WRAP-AROUND (téléportation aux bords opposés) :
     *   - Sort à gauche (x < 0)          → réapparaît à droite (x = width - 1)
     *   - Sort à droite (x >= width)     → réapparaît à gauche (x = 0)
     *   - Sort en haut (y < 0)           → réapparaît en bas (y = height - 1)
     *   - Sort en bas (y >= height)      → réapparaît en haut (y = 0)
     *
     * @modifies player.snake - Ajoute une nouvelle tête et potentiellement retire la queue
     */
    function moveSnake(player, gridWidth, gridHeight, tickCount) {
        if (!player.snake || player.snake.length === 0) return;

        const head = player.snake[0];  // Position actuelle de la tête

        // ÉTAPE 1 : Calcul de la nouvelle position
        let newHead = {
            x: head.x + player.direction.x,
            y: head.y + player.direction.y
        };

        // WRAP-AROUND : Téléportation aux bords opposés
        if (newHead.x < 0) {
            newHead.x = gridWidth - 1;  // Bord gauche → bord droit
        } else if (newHead.x >= gridWidth) {
            newHead.x = 0;  // Bord droit → bord gauche
        }

        if (newHead.y < 0) {
            newHead.y = gridHeight - 1;  // Bord haut → bord bas
        } else if (newHead.y >= gridHeight) {
            newHead.y = 0;  // Bord bas → bord haut
        }

        // ÉTAPE 2 : Ajoute la nouvelle tête au serpent
        // unshift() ajoute au début → nouvelle tête devient index 0
        player.snake.unshift(newHead);

        // ÉTAPE 3 : Gestion de la croissance
        // Le serpent ne grandit que tous les 4 ticks
        // Entre-temps, on retire la queue pour maintenir la longueur
        if (tickCount % 2 !== 0) {
            player.snake.pop();  // Retire le dernier segment (queue)
        }
        // Si tickCount % 4 === 0 → pas de pop() → le serpent grandit d'une cellule
    }

    // ========================================================================
    // BOUCLE PRINCIPALE DU JEU (GAME LOOP)
    // ========================================================================

    /**
     * Boucle principale du jeu - Exécutée toutes les 300ms (tick rate)
     *
     * @param {SnakeGame} game - Partie en cours
     *
     * @description Cycle de jeu en 5 étapes :
     *
     *   PHASE COUNTDOWN :
     *   - Démarre le timer si pas encore démarré (3, 2, 1, GO!)
     *   - Attend que game.started = true pour commencer
     *
     *   PHASE PLAYING (chaque tick) :
     *   1. Mise à jour des directions (avec validation anti-retour)
     *   2. Déplacement des serpents (ajout de nouvelle tête + wrap-around)
     *   3. Détection des collisions (self, adversaire)
     *   4. Détermination du gagnant si un joueur meurt
     *   5. Broadcast de l'état à tous les clients connectés
     *
     * GESTION DE FIN :
     *   - Si un joueur meurt → détermine le gagnant
     *   - Si mode remote → envoie les résultats au service users
     *   - Arrête la game loop (clearInterval)
     *
     * SÉCURITÉ :
     *   - Vérifie que des clients sont connectés (sinon arrête la loop)
     */
    function snakeGameLoop(game) {
        // Sécurité : arrête la loop si aucun client connecté
        if (!game.socket || game.socket.length === 0) {
            clearInterval(game.loopId);
            return;
        }

        // === PHASE COUNTDOWN ===
        // Démarre le timer de 3 secondes la première fois
        if (game.timerStarted === false) {
            game.timerStarted = true;
            startTimer(game);  // Lance le countdown (interval de 1s)
        }

        // === PHASE PLAYING ===
        // N'exécute la logique que si le jeu a démarré (countdown terminé)
        if (game.started === true) {
            game.tickCount++;  // Incrémente le compteur de ticks

            // 1. MISE À JOUR DES DIRECTIONS
            // Applique les inputs des joueurs avec validation anti-retour
            if (game.player1.alive) {
                updateSnakeDirection(game.player1, game.grid.width, game.grid.height);
            }
            if (game.player2.alive) {
                updateSnakeDirection(game.player2, game.grid.width, game.grid.height);
            }

            // 2. DÉPLACEMENT DES SERPENTS
            // Calcule et ajoute la nouvelle tête (avec wrap-around)
            // Le serpent grandit tous les 4 ticks
            if (game.player1.alive) {
                moveSnake(game.player1, game.grid.width, game.grid.height, game.tickCount);
            }
            if (game.player2.alive) {
                moveSnake(game.player2, game.grid.width, game.grid.height, game.tickCount);
            }

            // 3. DÉTECTION DES COLLISIONS
            // Vérifie : collision avec soi-même, collision avec adversaire
            // (les collisions de bordure ont été supprimées → wrap-around)
            checkCollisions(game);

            // 4. GESTION DE FIN DE PARTIE
            // Si au moins un joueur est mort → fin de partie
            if (!game.player1.alive || !game.player2.alive) {
                determineWinner(game);  // Définit winner et displayWinner
                game.message = "END";

                // Sauvegarde les résultats si partie en ligne
                if (game.mode === "remote") {
                    sendResult(game);
                    games.delete(game.id);  // POST vers service users
                }

                // Arrête la game loop
                clearInterval(game.loopId);
            } else {
                // Partie continue
                game.message = "Playing";
            }

            // 5. BROADCAST DE L'ÉTAT
            // Envoie l'état mis à jour à tous les clients connectés
            game.socket.forEach(socket => {
                if (socket.readyState === 1) {  // 1 = WebSocket.OPEN
                    socket.send(JSON.stringify(serializeGameState(game)));
                }
            });
        }
    }

    // ========================================================================
    // ROUTES HTTP
    // ========================================================================

    // HTTP Routes

    // Local game route
    fastify.get("/local", async (request, reply) => {
        try {
            const game = new SnakeGame({
                id: gameId++,
                socket: [],
                mode: 'local',
                message: 'start'
            });

            // Initialize both snakes with random positions
            const spawn1 = generateRandomSpawn(game.grid.width, game.grid.height, null);
            game.player1.snake = spawn1.snake;
            game.player1.direction = spawn1.direction;
            game.player1.nextDirection = spawn1.direction;
            game.player1.name = "Player 1";

            const spawn2 = generateRandomSpawn(game.grid.width, game.grid.height, game.player1.snake);
            game.player2.snake = spawn2.snake;
            game.player2.direction = spawn2.direction;
            game.player2.nextDirection = spawn2.direction;
            game.player2.name = "Player 2";

            games.set(game.id, game);
            reply.send(game);
        } catch (e) {
            console.error(e.message);
            reply.send([]);
        }
    });

    // Remote game route with ELO-based matchmaking
    fastify.get("/remote", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];

            if (!userId) {
                return reply.status(401).send({ error: "User ID required" });
            }

            // Vérifier si le joueur est déjà en partie
            for (const game of games.values()) {
                if (game.player1.id === userId || game.player2.id === userId) {
                    return reply.status(400).send({ error: "User is already in a game" });
                }
            }

            // Vérifier si le joueur est déjà en attente
            const alreadyInQueue = pendingRemoteQueue.find(entry => entry.userId === userId);
            if (alreadyInQueue) {
                return reply.status(400).send({ error: "User is already in queue" });
            }

            // Récupérer les infos du joueur
            const userName = await getUserName(userId);
            const userElo = await getUserElo(userId);

            // Calculer la tolérance basée sur le joueur le plus ancien en attente
            let tolerance = 100;  // Tolérance par défaut
            if (pendingRemoteQueue.length > 0) {
                const oldestEntry = pendingRemoteQueue[0];
                const waitTime = Date.now() - oldestEntry.timestamp;
                tolerance = calculateEloTolerance(waitTime);
            }

            // Chercher un adversaire compatible
            const opponent = findBestMatch(userElo, tolerance, pendingRemoteQueue);

            if (!opponent) {
                // Aucun adversaire trouvé: créer une partie en attente
                const game = new SnakeGame({
                    id: gameId++,
                    socket: [],
                    mode: 'remote',
                    message: "Waiting"
                });

                // Initialiser Player 1
                const spawn1 = generateRandomSpawn(game.grid.width, game.grid.height, null);
                game.player1.snake = spawn1.snake;
                game.player1.direction = spawn1.direction;
                game.player1.nextDirection = spawn1.direction;
                game.player1.id = userId;
                game.player1.name = userName;

                // Ajouter à la queue avec ELO et timestamp
                pendingRemoteQueue.push({
                    game: game,
                    userId: userId,
                    userName: userName,
                    elo: userElo,
                    timestamp: Date.now()
                });

                games.set(game.id, game);
                return reply.send(game);
            } else {
                // Adversaire trouvé: démarrer la partie
                const gameEntry = opponent;
                const game = games.get(gameEntry.game.id);

                // Vérifier que la partie existe toujours
                if (!game) {
                    // Partie disparue, retirer de la queue et recommencer
                    const index = pendingRemoteQueue.indexOf(gameEntry);
                    if (index !== -1) {
                        pendingRemoteQueue.splice(index, 1);
                    }
                    return reply.status(404).send({ error: "Game no longer available" });
                }

                // Initialiser Player 2
                const spawn2 = generateRandomSpawn(game.grid.width, game.grid.height, game.player1.snake);
                game.player2.snake = spawn2.snake;
                game.player2.direction = spawn2.direction;
                game.player2.nextDirection = spawn2.direction;
                game.player2.id = userId;
                game.player2.name = userName;

                game.message = "start";
                games.set(game.id, game);

                // Retirer l'adversaire de la queue
                const index = pendingRemoteQueue.indexOf(gameEntry);
                if (index !== -1) {
                    pendingRemoteQueue.splice(index, 1);
                }

                reply.send(game);

                // Notifier Player 1 que la partie commence
                game.socket.forEach(socket => {
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify(serializeGameState(game)));
                    }
                });
            }
        } catch (e) {
            console.error(e.message);
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    // State query route
    fastify.get("/state/:id", async (request, reply) => {
        try {
            const id = parseInt(request.params.id, 10);
            if (!games.has(id)) {
                return reply.status(404).send({ error: "Game not found" });
            }
            const game = games.get(id);
            reply.send(game);
        } catch(e) {
            reply.status(404).send({ error: e.message });
        }
    });

    // WebSocket Handler
    const wss = new WebSocketServer({
        server: fastify.server,
        path: '/ws'
    });

    wss.on('connection', function connection(ws) {
        ws.on('error', function(error) {
            console.error('WebSocket error:', {
                message: error.message,
                code: error.code,
                userId: ws.userId || 'unknown'
            });
        });

        ws.on('message', function message(data) {
            try {
                const res = JSON.parse(data.toString());

                // ✅ CORRECTIF : Vérifier avec !== undefined au lieu de !res.game.id
                if (!res.game || res.game.id === undefined || res.game.id === null) {
                    ws.send(JSON.stringify({ message: "Error", error: "Invalid game data" }));
                    return;
                }

                const gameId = parseInt(res.game.id, 10);
                
                if (!games.has(gameId)) {
                    ws.send(JSON.stringify({ message: "Error", error: "Game not found" }));
                    return;
                }

                let game = games.get(gameId);

                if (res.message === "Init") {
                    // Pair WebSocket with player for remote games
                    if (game.mode === "remote") {
                        if (ws.userId === undefined && game.socket.length === 0) {
                            ws.userId = game.player1.id;
                        } else if (ws.userId === undefined && game.socket.length === 1) {
                            ws.userId = game.player2.id;
                        }
                    }

                    game.socket.push(ws);
                    games.set(game.id, game);

                    // Start game loop only when conditions are met
                    if (game.loopId === null) {
                        // For remote games, wait for both players to connect
                        if (game.mode === "remote" && game.socket.length < 2) {
                            // Don't start yet, waiting for second player
                            ws.send(JSON.stringify(serializeGameState(game)));
                        } else {
                            // Start the game loop (local mode or remote with 2 players)
                            game.loopId = setInterval(() => snakeGameLoop(game), 300);

                            // Send initial state to all connected sockets
                            game.socket.forEach(socket => {
                                if (socket.readyState === 1) {
                                    socket.send(JSON.stringify(serializeGameState(game)));
                                }
                            });
                        }
                    } else {
                        // Loop already started, just send current state
                        ws.send(JSON.stringify(serializeGameState(game)));
                    }

                }
                else if (res.message === "input") {
                    // Handle direction changes
                    if (game.mode === "remote") {
                        // Remote mode: only accept inputs from paired player
                        if (ws.userId === game.player1.id && res.game.player1.nextDirection) {
                            if (isValidDirection(res.game.player1.nextDirection)) {
                                game.player1.nextDirection = res.game.player1.nextDirection;
                            } else {
                                ws.send(JSON.stringify({ message: "Error", error: "Invalid direction" }));
                            }
                        } else if (ws.userId === game.player2.id && res.game.player2.nextDirection) {
                            if (isValidDirection(res.game.player2.nextDirection)) {
                                game.player2.nextDirection = res.game.player2.nextDirection;
                            } else {
                                ws.send(JSON.stringify({ message: "Error", error: "Invalid direction" }));
                            }
                        }
                    } else {
                        // Local mode: both players from same client
                        if (res.game.player1.nextDirection) {
                            if (isValidDirection(res.game.player1.nextDirection)) {
                                game.player1.nextDirection = res.game.player1.nextDirection;
                            }
                        }
                        if (res.game.player2.nextDirection) {
                            if (isValidDirection(res.game.player2.nextDirection)) {
                                game.player2.nextDirection = res.game.player2.nextDirection;
                            }
                        }
                    }

                    games.set(game.id, game);
                }
            } catch (e) {
                console.error("WebSocket message error:", e.message);
                ws.send(JSON.stringify({ message: "Error", error: e.message }));
            }
        });

        ws.on('close', function close() {
            console.log("WebSocket connection closed");

            // Nettoyage de la queue d'attente (retirer les parties invalides)
            pendingRemoteQueue = pendingRemoteQueue.filter(entry => {
                const game = games.get(entry.game.id);
                return game !== undefined;
            });

            // Cleanup: find and remove this WebSocket from all games
            games.forEach((game, gameId) => {
                const socketIndex = game.socket.indexOf(ws);
                if (socketIndex !== -1) {
                    game.socket.splice(socketIndex, 1);

                    // If no more sockets connected, clean up the game
                    if (game.socket.length === 0) {
                        if (game.loopId) {
                            clearInterval(game.loopId);
                        }
                        games.delete(gameId);

                        // Remove from pending queue if present
                        const pendingIndex = pendingRemoteQueue.findIndex(entry => entry.game.id === gameId);
                        if (pendingIndex !== -1) {
                            pendingRemoteQueue.splice(pendingIndex, 1);
                        }

                        console.log(`Game ${gameId} cleaned up`);
                    }
                }
            });
        });
    });

    // Start server
    fastify.listen({host: HOST, port: PORT}, (err) => {
        if (err) {
            fastify.log.error(err);
            process.exit(1);
        }
        console.log(`Snake game server running on ${HOST}:${PORT}`);
    });
}

runServer();

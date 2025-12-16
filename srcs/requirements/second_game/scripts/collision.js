/**
 * Détecte toutes les collisions mortelles pour les deux joueurs
 *
 * @param {SnakeGame} game - Instance de la partie en cours
 *
 * @description Cette fonction vérifie deux types de collisions pour chaque joueur :
 *   1. COLLISION AVEC SOI-MÊME : La tête du serpent touche son propre corps
 *      - Compare la position de la tête (index 0) avec tous les segments du corps (index 1+)
 *      - Mort instantanée si collision détectée
 *
 *   2. COLLISION AVEC L'ADVERSAIRE : La tête du serpent touche le corps de l'autre serpent
 *      - Compare la position de la tête avec TOUS les segments de l'adversaire (y compris sa tête)
 *      - Permet les collisions frontales (les deux meurent)
 *
 * NOTE : Les collisions avec les bords ont été supprimées
 *        Le système de wrap-around (téléportation) est maintenant géré dans moveSnake()
 *
 * @modifies game.player1.alive - Mis à false en cas de collision
 * @modifies game.player2.alive - Mis à false en cas de collision
 */
export function checkCollisions(game) {
    // === Vérifications pour le Joueur 1 ===
    if (game.player1.alive && game.player1.snake.length > 0) {
        const head1 = game.player1.snake[0];  // Position de la tête (premier segment)

        // Border collision removed - wrap-around is now handled in moveSnake()

        // COLLISION AVEC SOI-MÊME
        // Parcourt tous les segments du corps (index 1 à length-1)
        for (let i = 1; i < game.player1.snake.length; i++) {
            if (head1.x === game.player1.snake[i].x &&
                head1.y === game.player1.snake[i].y) {
                game.player1.alive = false;  // Le serpent se mord lui-même
                break;  // Inutile de continuer à vérifier
            }
        }

        // COLLISION AVEC LE JOUEUR 2
        // Vérifie si la tête de P1 touche n'importe quel segment de P2
        if (game.player2.snake.length > 0) {
            for (let segment of game.player2.snake) {
                if (head1.x === segment.x && head1.y === segment.y) {
                    game.player1.alive = false;  // P1 touche P2
                    break;
                }
            }
        }
    }

    // === Vérifications pour le Joueur 2 ===
    if (game.player2.alive && game.player2.snake.length > 0) {
        const head2 = game.player2.snake[0];  // Position de la tête

        // Border collision removed - wrap-around is now handled in moveSnake()

        // COLLISION AVEC SOI-MÊME
        for (let i = 1; i < game.player2.snake.length; i++) {
            if (head2.x === game.player2.snake[i].x &&
                head2.y === game.player2.snake[i].y) {
                game.player2.alive = false;  // Le serpent se mord lui-même
                break;
            }
        }

        // COLLISION AVEC LE JOUEUR 1
        // Vérifie si la tête de P2 touche n'importe quel segment de P1
        if (game.player1.snake.length > 0) {
            for (let segment of game.player1.snake) {
                if (head2.x === segment.x && head2.y === segment.y) {
                    game.player2.alive = false;  // P2 touche P1
                    break;
                }
            }
        }
    }
}

/**
 * Détermine le gagnant de la partie en fonction des serpents encore en vie
 *
 * @param {SnakeGame} game - Instance de la partie en cours
 *
 * @description Analyse l'état des joueurs et définit le gagnant selon 3 scénarios :
 *   - Les deux morts → Match nul (collision simultanée)
 *   - Joueur 1 mort uniquement → Joueur 2 gagne
 *   - Joueur 2 mort uniquement → Joueur 1 gagne
 *
 * @modifies game.winner - Définit "Draw", "Player1", ou "Player2"
 * @modifies game.displayWinner - Message formaté pour l'affichage (inclut les noms si disponibles)
 */
export function determineWinner(game) {
    // CAS 1 : Les deux serpents sont morts (collision frontale)
    if (!game.player1.alive && !game.player2.alive) {
        game.winner = "Draw";
        game.displayWinner = "Draw! Both snakes died";
    }
    // CAS 2 : Seul le Joueur 1 est mort → Joueur 2 gagne
    else if (!game.player1.alive) {
        game.winner = "Player2";
        // Affiche le nom du joueur si disponible, sinon "Player 2"
        game.displayWinner = game.player2.name ? `${game.player2.name} wins!` : "Player 2 wins!";
    }
    // CAS 3 : Seul le Joueur 2 est mort → Joueur 1 gagne
    else {
        game.winner = "Player1";
        // Affiche le nom du joueur si disponible, sinon "Player 1"
        game.displayWinner = game.player1.name ? `${game.player1.name} wins!` : "Player 1 wins!";
    }
}

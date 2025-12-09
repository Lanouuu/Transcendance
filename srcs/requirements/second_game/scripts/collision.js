export function checkCollisions(game) {
    const grid = game.grid;

    // Check Player 1
    if (game.player1.alive && game.player1.snake.length > 0) {
        const head1 = game.player1.snake[0];

        // Border collision
        if (head1.x < 0 || head1.x >= grid.width ||
            head1.y < 0 || head1.y >= grid.height) {
            game.player1.alive = false;
        }

        // Self collision (check if head hits body)
        for (let i = 1; i < game.player1.snake.length; i++) {
            if (head1.x === game.player1.snake[i].x &&
                head1.y === game.player1.snake[i].y) {
                game.player1.alive = false;
                break;
            }
        }

        // Collision with Player 2's snake
        if (game.player2.snake.length > 0) {
            for (let segment of game.player2.snake) {
                if (head1.x === segment.x && head1.y === segment.y) {
                    game.player1.alive = false;
                    break;
                }
            }
        }
    }

    // Check Player 2
    if (game.player2.alive && game.player2.snake.length > 0) {
        const head2 = game.player2.snake[0];

        // Border collision
        if (head2.x < 0 || head2.x >= grid.width ||
            head2.y < 0 || head2.y >= grid.height) {
            game.player2.alive = false;
        }

        // Self collision
        for (let i = 1; i < game.player2.snake.length; i++) {
            if (head2.x === game.player2.snake[i].x &&
                head2.y === game.player2.snake[i].y) {
                game.player2.alive = false;
                break;
            }
        }

        // Collision with Player 1's snake
        if (game.player1.snake.length > 0) {
            for (let segment of game.player1.snake) {
                if (head2.x === segment.x && head2.y === segment.y) {
                    game.player2.alive = false;
                    break;
                }
            }
        }
    }
}

export function determineWinner(game) {
    if (!game.player1.alive && !game.player2.alive) {
        game.winner = "Draw";
        game.displayWinner = "Draw! Both snakes died";
    } else if (!game.player1.alive) {
        game.winner = "Player2";
        game.displayWinner = game.player2.name ? `${game.player2.name} wins!` : "Player 2 wins!";
    } else {
        game.winner = "Player1";
        game.displayWinner = game.player1.name ? `${game.player1.name} wins!` : "Player 1 wins!";
    }
}

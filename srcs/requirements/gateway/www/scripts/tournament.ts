import { gameLoop } from './game.js'
import { Game } from "./gameClass.js"

const ws_route: string = `://${window.location.host}/game`
const route: string = `${window.location.origin}/tournament`;

export async function displayTournamentPage() {

    const userId: string | null = sessionStorage.getItem("userId");
    const token: string | null = sessionStorage.getItem("jwt");

    if (userId === null || token === null) {
        console.error('Could not fetch user id/token');
        return;
    }

    // #region Creation //

    const selectMaxPlayer: HTMLSelectElement = document.getElementById("tournamentSelectMaxPlayer") as HTMLSelectElement;
    const localSelectionButton: HTMLButtonElement = document.getElementById("localSelectionButton") as HTMLButtonElement;
    const remoteSelectionButton: HTMLButtonElement = document.getElementById("remoteSelectionButton") as HTMLButtonElement;
    const createTournamentButton: HTMLButtonElement = document.getElementById("createTournamentButton") as HTMLButtonElement;
    const tournamentCreationMsg: HTMLDivElement = document.getElementById("tournamentCreationMsg") as HTMLDivElement;

    if (!selectMaxPlayer || !localSelectionButton || !remoteSelectionButton || !createTournamentButton || !tournamentCreationMsg) {
        console.error("Could not get HTML elements");
        return;
    }

    let maxPlayerSelected = "";
    selectMaxPlayer.addEventListener('change', (e) => {
        if (e) {
            const target = e.target as HTMLSelectElement;
            maxPlayerSelected = target.value;
            console.log("Selected max players:", maxPlayerSelected);
        }
    });

    let modeSelected = "";
    localSelectionButton.onclick = () => {
        modeSelected = "local";
        localSelectionButton.classList.add('outline', 'outline-accent');
        remoteSelectionButton.classList.remove('outline', 'outline-accent');
        console.log("Selected tournament type:", modeSelected);
    };
    remoteSelectionButton.onclick = () => {
        modeSelected = "remote";
        remoteSelectionButton.classList.add('outline', 'outline-accent');
        localSelectionButton.classList.remove('outline', 'outline-accent');
        console.log("Selected tournament type:", modeSelected);
    };

    createTournamentButton.onclick = async () => {
        if (maxPlayerSelected !== "4" && maxPlayerSelected !== "8" && maxPlayerSelected !== "16") {
            displayMsg(tournamentCreationMsg, "Please select the max player number option", "red");
            return;
        }
        if (modeSelected !== "local" && modeSelected !== "remote") {
            displayMsg(tournamentCreationMsg, "Please select a mode for the tournament", "red");
            return;
        }
        createTournament(userId, token, maxPlayerSelected, modeSelected, tournamentCreationMsg);
    };

    // #endregion Creation //

    displayTournamentList(userId, token);

    // #region old //


    // // Créer le bouton Join
    // const joinButton = document.createElement('button');
    // joinButton.id = 'gameTournamentJoinButton';
    // joinButton.className = 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 ml-4';
    // joinButton.textContent = 'Join tournament';

    // // Container pour la liste des tournois
    // const tournamentListContainer = document.createElement('div');
    // tournamentListContainer.id = 'tournamentListContainer';
    // tournamentListContainer.className = 'hidden mt-6 p-4 bg-gray-100 rounded-lg';

    // // Ajouter après le bouton Join
    // const startButton = document.createElement('button');
    // startButton.id = 'gameTournamentStartButton';
    // startButton.className = 'bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 ml-4';
    // startButton.textContent = 'Start Tournament';

    // Ajouter après le h1
    // const h1 = tournamentPage.querySelector('h1');
    // if (h1) {
    // 	h1.insertAdjacentElement('afterend', select);
    // 	select.insertAdjacentElement('afterend', button);
    //     button.insertAdjacentElement('afterend', localTournamentButton);
    //     localTournamentButton.insertAdjacentElement('afterend', joinButton);
    //     joinButton.insertAdjacentElement('afterend', tournamentListContainer);
    //     joinButton.insertAdjacentElement('afterend', startButton);  // AJOUTER CETTE LIGNE
    // } else {
    //     tournamentPage.appendChild(select);
    //     tournamentPage.appendChild(button);
    //     tournamentPage.appendChild(localTournamentButton);
    //     tournamentPage.appendChild(joinButton);
    //     tournamentPage.appendChild(tournamentListContainer);
    //     tournamentPage.appendChild(startButton);  // AJOUTER CETTE LIGNE
    // }

    //#####################################


    // ✓ Listener pour le bouton Join
    // joinButton.addEventListener('click', async () => {
    //     console.log("Join button clicked");

    //     try {
    //         const token = sessionStorage.getItem("jwt");
    //         const userId = sessionStorage.getItem("userId");

    //         if (!userId || !token) {
    //             console.error('Could not fetch user id/token');
    //             return;
    //         }

    //         // Récupérer la liste des tournois
    //         const res = await fetch(`${route}/tournamentList`, {
    //             method: "GET",
    //             headers: {
    //                 "authorization": `Bearer ${token}`,
    //                 "x-user-id": userId
    //             }
    //         });

    //         if (!res.ok) {
    //             throw new Error(`Failed to fetch tournaments: ${res.status}`);
    //         }

    //         const tournaments = await res.json();
    //         console.log("Tournaments:", tournaments);

    //         // Afficher la liste
    //         tournamentListContainer.innerHTML = '<h3 class="text-xl font-bold mb-4">Available Tournaments</h3>';

    //         if (tournaments.length === 0) {
    //             tournamentListContainer.innerHTML += '<p class="text-gray-600">No tournaments available</p>';
    //         } else {
    //             const list = document.createElement('ul');
    //             list.className = 'space-y-2';

    //             tournaments.forEach((tournament: any) => {
    //                 const item = document.createElement('li');
    //                 item.className = 'flex justify-between items-center bg-white p-3 rounded shadow';

    //                 const info = document.createElement('div');
    //                 info.innerHTML = `
    //                     <p class="font-semibold">${tournament.name}</p>
    //                     <p class="text-sm text-gray-600">Players: ${tournament.nb_current_players}/${tournament.nb_max_players}</p>
    //                 `;

    //                 const joinBtn = document.createElement('button');
    //                 joinBtn.className = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded';
    //                 joinBtn.disabled = tournament.nb_current_players >= tournament.nb_max_players;

    //                 if (joinBtn.disabled) {
    //                     joinBtn.className = 'bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed';
    //                     joinBtn.textContent = 'Full';
    //                 }

    //                 joinBtn.addEventListener('click', async () => {
    //                     await joinTournament(tournament.id, token, userId);
    //                 });

    //                 item.appendChild(info);
    //                 item.appendChild(joinBtn);
    //                 list.appendChild(item);
    //             });

    //             tournamentListContainer.appendChild(list);
    //         }

    //         tournamentListContainer.classList.remove('hidden');

    //     } catch (err) {
    //         console.error("Failed to fetch tournaments:", err);
    //         alert("Failed to load tournaments");
    //     }
    // });
    //END#####################################

    // createTournamentButton.addEventListener('click', async () => {
    //     console.log("Bouton cliqué");

    //     if (!selected || selected === "") {
    //         alert("Please select max number of players");
    //         return;
    //     }

    //     const tournamentName = `Tournament ${Date.now()}`; // Générer nom unique

    //     try {
    //         const token: string | null = sessionStorage.getItem("jwt");
    //         const userId: string | null = sessionStorage.getItem("userId");
    //         if (userId === null || token === null) {
    //             console.error('Could not fetch user id/token');
    //             return;
    //         }

    //         const res = await fetch(`${route}/tournamentCreate`, {
    //             method: "POST",
    //             headers: {
    //                 "authorization": `Bearer ${token}`,
    //                 "x-user-id": userId,
    //                 "Content-Type": "application/json"
    //             },
    //             body: JSON.stringify({ name: tournamentName, creator_id: userId, nb_max_players: selected, mode: "remote" })
    //         });
    //         if (!res.ok) {
    //             const text = await res.text();
    //             console.error(`Server error ${res.status}:`, text);
    //             throw new Error(`Failed to load the game`);
    //         }

    //         const contentType = res.headers.get("content-type");
    //         if (!contentType || !contentType.includes("application/json")) {
    //             const text = await res.text();
    //             console.error(`Server did not return JSON`, text);
    //             throw new Error(`Server response is not JSON`);
    //         }

    //         const response = await res.json();

    //         if (response.message === "Success") {
    //             let game: Game;
    //             const ws = new WebSocket(`wss${ws_route}/ws`); // A MODIFIER
    //             ws.addEventListener('open', (event) => {
    //                 if (ws.readyState === WebSocket.OPEN)
    //                     ws.send(JSON.stringify({ gameId: response.id, tournamentId: response.tournamentId, id: userId, message: "InitTournament" }))
    //             })

    //             ws.addEventListener('message', (event) => {
    //                 const serverGame = JSON.parse(event.data)
    //                 if (serverGame.message === "Init") {
    //                     console.log("Starting match")
    //                     game = serverGame.game;
    //                     window.location.hash = '#game';
    //                     window.dispatchEvent(new Event('hashchange'));
    //                     setTimeout(() => {
    //                         gameLoop(game, ws);
    //                     }, 1000);
    //                 }
    //                 else if (game && serverGame.message === "Countdown") {
    //                     game.message = serverGame.message
    //                     game.timer = serverGame.timer
    //                 }
    //                 else if (game && serverGame.message === "Playing") {
    //                     game.message = serverGame.message
    //                     game.started = serverGame.started
    //                     game.player1.sprite.position.y = serverGame.player1.sprite.position.y
    //                     game.player2.sprite.position.y = serverGame.player2.sprite.position.y
    //                     game.ball.position.x = serverGame.ball.position.x
    //                     game.ball.position.y = serverGame.ball.position.y
    //                     game.player1.score = serverGame.player1.score
    //                     game.player2.score = serverGame.player2.score
    //                 }
    //                 else if (game && serverGame.message === "END") {
    //                     game.message = serverGame.message
    //                     game.winner = serverGame.winner
    //                     game.displayWinner = serverGame.displayWinner
    //                     game.player1.score = serverGame.player1.score
    //                     game.player2.score = serverGame.player2.score
    //                 }
    //             })

    //             ws.addEventListener('error', (error) => {
    //                 console.error("WebSocket error:", error);
    //             });
    //         }
    //     } catch (err) {
    //         console.error(err);
    //     }


    // });

    // LOCAL TOURNAMENT
    // localTournamentButton.addEventListener('click', async () => {
    //     console.log("tournoi local bouton cliqué");

    //     if (!selected || selected === "") {
    //         alert("Please select max number of players");
    //         return;
    //     }

    //     const tournamentName = `Tournament ${Date.now()}`; // Générer nom unique

    //     try {
    //         const token: string | null = sessionStorage.getItem("jwt");
    //         const userId: string | null = sessionStorage.getItem("userId");
    //         if (userId === null || token === null) {
    //             console.error('Could not fetch user id/token');
    //             return;
    //         }

    //         const res = await fetch(`${route}/tournamentCreate`, {
    //             method: "POST",
    //             headers: {
    //                 "authorization": `Bearer ${token}`,
    //                 "x-user-id": userId,
    //                 "Content-Type": "application/json"
    //             },
    //             body: JSON.stringify({ name: tournamentName, creator_id: userId, nb_max_players: selected, mode: "local" })
    //         });
    //         if (!res.ok) {
    //             const text = await res.text();
    //             console.error(`Server error ${res.status}:`, text);
    //             throw new Error(`Failed to load the game`);
    //         }

    //         const contentType = res.headers.get("content-type");
    //         if (!contentType || !contentType.includes("application/json")) {
    //             const text = await res.text();
    //             console.error(`Server did not return JSON`, text);
    //             throw new Error(`Server response is not JSON`);
    //         }

    //         const response = await res.json();

    //         if (response.message === "Success") {
    //             let game: Game;
    //             const ws = new WebSocket(`wss${ws_route}/ws`); // A MODIFIER
    //             ws.addEventListener('open', (event) => {
    //                 if (ws.readyState === WebSocket.OPEN)
    //                     ws.send(JSON.stringify({ gameId: response.id, tournamentId: response.tournamentId, id: userId, message: "InitTournament" }))
    //             })

    //             ws.addEventListener('message', (event) => {
    //                 const serverGame = JSON.parse(event.data)
    //                 if (serverGame.message === "Init") {
    //                     console.log("Starting match")
    //                     game = serverGame.game;
    //                     window.location.hash = '#game';
    //                     window.dispatchEvent(new Event('hashchange'));
    //                     setTimeout(() => {
    //                         gameLoop(game, ws);
    //                     }, 1000);
    //                 }
    //                 else if (game && serverGame.message === "Countdown") {
    //                     game.message = serverGame.message
    //                     game.timer = serverGame.timer
    //                 }
    //                 else if (game && serverGame.message === "Playing") {
    //                     game.message = serverGame.message
    //                     game.started = serverGame.started
    //                     game.player1.sprite.position.y = serverGame.player1.sprite.position.y
    //                     game.player2.sprite.position.y = serverGame.player2.sprite.position.y
    //                     game.ball.position.x = serverGame.ball.position.x
    //                     game.ball.position.y = serverGame.ball.position.y
    //                     game.player1.score = serverGame.player1.score
    //                     game.player2.score = serverGame.player2.score
    //                 }
    //                 else if (game && serverGame.message === "END") {
    //                     game.message = serverGame.message
    //                     game.winner = serverGame.winner
    //                     game.displayWinner = serverGame.displayWinner
    //                     game.player1.score = serverGame.player1.score
    //                     game.player2.score = serverGame.player2.score
    //                 }
    //             })

    //             ws.addEventListener('error', (error) => {
    //                 console.error("WebSocket error:", error);
    //             });
    //         }
    //     } catch (err) {
    //         console.error(err);
    //     }
    // });
    //END
    //     // Ajouter le listener pour le bouton Start (à placer après la fonction joinTournament)
    //     startButton.addEventListener('click', async () => {
    //         console.log("Start Tournament button clicked");

    //         try {
    //             const token = sessionStorage.getItem("jwt");
    //             const userId = sessionStorage.getItem("userId");

    //             if (!userId || !token) {
    //                 console.error('Could not fetch user id/token');
    //                 alert('Please login first');
    //                 return;
    //             }

    //             // Confirmation avant de lancer
    //             if (!confirm('Are you sure you want to start the tournament?')) {
    //                 return;
    //             }

    //             const res = await fetch(`${route}/tournamentStart`, {
    //                 method: "POST",
    //                 headers: {
    //                     "authorization": `Bearer ${token}`,
    //                     "x-user-id": userId,
    //                 }
    //             });

    //             // if (!res.ok) {
    //             //     const errorText = await res.text();
    //             //     console.error(`Server error ${res.status}:`, errorText);
    //             //     throw new Error(`Failed to start tournament: ${res.status}`);
    //             // }

    //             console.log("Tournament started successfully!");

    //         } catch (err) {
    //             console.error("Failed to start tournament:", err);
    //             alert(`Error starting tournament: ${err}`);
    //         }
    //     });
    // #endregion old //
};

// Pour les tournois en local demander a jacky comment ils ont gere le bail

async function createTournament(userId: string, token: string, maxPlayerSelected: string, tournamentMode: string, msg: HTMLDivElement) {

    const tournamentName = `Tournament ${Date.now()}`; // Générer nom unique

    try {
        const res = await fetch(`${route}/tournamentCreate`, {
            method: "POST",
            headers: {
                "authorization": `Bearer ${token}`,
                "x-user-id": userId,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: tournamentName, creator_id: userId, nb_max_players: maxPlayerSelected, mode: tournamentMode })
        });
        if (!res.ok) {
            const text = await res.json();
            console.error(`Server error ${res.status}:`, text.error);
            displayMsg(msg, `Error creating the tournament: ${text.error}`, "red");
            return;
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error(`Server did not return JSON`, text);
            displayMsg(msg, "Error creating the tournament", "red");
            return;
        }

        const response = await res.json();

        if (response.message === "Success") {
            let game: Game;
            const ws = new WebSocket(`wss${ws_route}/ws`); // A MODIFIER
            ws.addEventListener('open', (event) => {
                if (ws.readyState === WebSocket.OPEN)
                    ws.send(JSON.stringify({ gameId: response.id, tournamentId: response.tournamentId, id: userId, message: "InitTournament" }))
            })

            ws.addEventListener('message', (event) => {
                const serverGame = JSON.parse(event.data)
                if (serverGame.message === "Init") {
                    console.log("Starting match")
                    game = serverGame.game;
                    window.location.hash = '#game';
                    window.dispatchEvent(new Event('hashchange'));
                    setTimeout(() => {
                        gameLoop(game, ws);
                    }, 1000);
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

            ws.addEventListener('error', (error) => {
                console.error("WebSocket error:", error);
            });
            displayMsg(msg, "Tournament created", "green");
        }
        else {
            displayMsg(msg, "Tournament creation failed", "red");
        }
    } catch (err) {
        console.error(err);
    }
}

async function displayTournamentList(userId: string, token: string) {
    const tournamentList: HTMLUListElement = document.getElementById("tournamentList") as HTMLUListElement;
    const tournamentListMsg: HTMLDivElement = document.getElementById("tournamentListMsg") as HTMLDivElement;
    const frag: DocumentFragment = document.createDocumentFragment();

    if (!tournamentList || !tournamentListMsg) {
        console.error("Could not get HTML elements");
        return;
    }

    try {
        const res = await fetch(`${route}/tournamentList`, {
            method: "GET",
            headers: {
                "authorization": `Bearer ${token}`,
                "x-user-id": userId
            }
        });

        if (!res.ok) {
            displayMsg(tournamentListMsg, "Failed to fetch tournament list", "red");
            return ;
        }

        const tournaments = await res.json();
        console.log("Tournaments:", tournaments);
        if (tournaments.length <= 0) {
            tournamentList.textContent = "No tournaments available"
        }
        tournaments.forEach((tournament: any) => {

            if (tournament.mode !== 'remote') return ;

            const li: HTMLLIElement = document.createElement('li');
            li.className = "";

            const infoDiv: HTMLDivElement = document.createElement('div');
            // Ajouter toutes les infos


            const joinButton: HTMLButtonElement = document.createElement('button');
            joinButton.className = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded';
            joinButton.textContent = 'Join';
            joinButton.disabled = tournament.nb_current_players >= tournament.nb_max_players;
            joinButton.onclick = async () => {await joinTournament(tournament.id, token, userId);};

            if (joinButton.disabled) {
                joinButton.classList.add('hidden');
            }

            li.append(infoDiv,joinButton);
            frag.appendChild(li);
        });
        tournamentList.appendChild(frag);

    } catch (error) {

    }

}

async function joinTournament(tournamentId: number, token: string, userId: string) {
    try {
        const res = await fetch(`${route}/tournamentJoin`, {
            method: "POST",
            headers: {
                "authorization": `Bearer ${token}`,
                "x-user-id": userId,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ idTour: tournamentId })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to join tournament");
        }

        const response = await res.json();
        console.log("Joined tournament:", response);
        alert("Successfully joined tournament!");

        if (response.message === "Success") {
            let game: Game;
            const ws = new WebSocket(`wss${ws_route}/ws`); // A MODIFIER
            ws.addEventListener('open', (event) => {
                if (ws.readyState === WebSocket.OPEN)
                    ws.send(JSON.stringify({ gameId: response.id, tournamentId: response.tournamentId, id: userId, message: "InitTournament" }))
            })

            ws.addEventListener('message', (event) => {
                const serverGame = JSON.parse(event.data)
                if (serverGame.message === "Init") {
                    console.log("Starting match")
                    game = serverGame.game;
                    window.location.hash = '#game';
                    window.dispatchEvent(new Event('hashchange'));
                    setTimeout(() => {
                        gameLoop(game, ws);
                    }, 100);
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

            ws.addEventListener('error', (error) => {
                console.error("WebSocket error:", error);
            });
        }


    } catch (err) {
        console.error("Failed to join tournament:", err);
        alert(`Error: ${err}`);
    }
}

function displayMsg(msgDiv: HTMLDivElement, msg: string, color: string): void {
    msgDiv.classList.toggle('opacity-0');
    msgDiv.classList.toggle('opacity-100');
    msgDiv.textContent = msg;
    msgDiv.style.color = color;
    setTimeout(() => {
        msgDiv.classList.toggle('opacity-100');
        msgDiv.classList.toggle('opacity-0');
    }, 2000);
}
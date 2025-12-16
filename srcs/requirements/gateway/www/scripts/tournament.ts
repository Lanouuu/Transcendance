import { gameLoop } from './game.js'

const ws_route: string = `://${window.location.host}/game`
const route: string = `${window.location.origin}/tournament`;

export async function displayTournamentPage () {

	const tournamentPage = document.getElementById('tournamentPage');
	if (!tournamentPage) {
		console.error("Could not find tournamentPage");
		return;
	}

	// Créer le select dynamiquement
	const select = document.createElement('select');
	select.id = 'tournamentSelectMaxPlayer';
	select.name = 'menu';
	select.className = 'p-2 m-4 border border-gray-300 rounded bg-white text-black';
	
	const options = ['', '4', '8', '16'];
	const optionTexts = ['-- Select Max player number --', '4', '8', '16'];
	
	options.forEach((val, idx) => {
		const option = document.createElement('option');
		option.value = val;
		option.textContent = optionTexts[idx];
		select.appendChild(option);
	});
	
	// Créer le bouton dynamiquement
	const button = document.createElement('button');
	button.id = 'gameTournamentButton';
	button.className = 'bg-prim hover:bg-sec text-white font-bold py-3 px-6 rounded-lg cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95';
	button.textContent = 'Create tournament';
	
    // Créer le bouton Join
    const joinButton = document.createElement('button');
    joinButton.id = 'gameTournamentJoinButton';
    joinButton.className = 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 ml-4';
    joinButton.textContent = 'Join tournament';

    // Container pour la liste des tournois
    const tournamentListContainer = document.createElement('div');
    tournamentListContainer.id = 'tournamentListContainer';
    tournamentListContainer.className = 'hidden mt-6 p-4 bg-gray-100 rounded-lg';


	// Ajouter après le h1
	const h1 = tournamentPage.querySelector('h1');
	if (h1) {
		h1.insertAdjacentElement('afterend', select);
		select.insertAdjacentElement('afterend', button);
        button.insertAdjacentElement('afterend', joinButton);
        joinButton.insertAdjacentElement('afterend', tournamentListContainer);
    } else {
        tournamentPage.appendChild(select);
        tournamentPage.appendChild(button);
        tournamentPage.appendChild(joinButton);
        tournamentPage.appendChild(tournamentListContainer);
    }
	const createTournamentButton: HTMLButtonElement = button;
    const selectMaxPlayer: HTMLSelectElement = select;

    let selected = "";
    selectMaxPlayer.addEventListener('change', (e) => {
        if (e) {
            const target = e.target as HTMLSelectElement;
            selected = target.value;
            console.log("Selected max players:", selected);
        }
    });

//#####################################
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

            const result = await res.json();
            console.log("Joined tournament:", result);
            alert("Successfully joined tournament!");

            // Ouvrir WebSocket pour recevoir les matchs
            const ws = new WebSocket(`wss${ws_route}/ws`);

            ws.addEventListener('open', () => {
                console.log("WebSocket connected");
                ws.send(JSON.stringify({
                    game: {
                        id: tournamentId,
                        creator_id: userId,
                        mode: "tournament",
                        action: "join"
                    },
                    message: "InitSocket"
                }));
            });

            ws.addEventListener('message', (event) => {
                const data = JSON.parse(event.data);
                console.log("WebSocket message:", data);
                
                if (data.message === "StartMatch") {
                    // Lancer le match
                    console.log("Starting match:", data);
                    // TODO: Appeler launchTournamentMatch(data)
                }
            });

            ws.addEventListener('error', (error) => {
                console.error("WebSocket error:", error);
            });

        } catch (err) {
            console.error("Failed to join tournament:", err);
            alert(`Error: ${err}`);
        }
    }

    // ✓ Listener pour le bouton Join
    joinButton.addEventListener('click', async () => {
        console.log("Join button clicked");
        
        try {
            const token = sessionStorage.getItem("jwt");
            const userId = sessionStorage.getItem("userId");
            
            if (!userId || !token) {
                console.error('Could not fetch user id/token');
                return;
            }

            // Récupérer la liste des tournois
            const res = await fetch(`${route}/tournamentList`, {
                method: "GET",
                headers: {
                    "authorization": `Bearer ${token}`,
                    "x-user-id": userId
                }
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch tournaments: ${res.status}`);
            }

            const tournaments = await res.json();
            console.log("Tournaments:", tournaments);

            // Afficher la liste
            tournamentListContainer.innerHTML = '<h3 class="text-xl font-bold mb-4">Available Tournaments</h3>';
            
            if (tournaments.length === 0) {
                tournamentListContainer.innerHTML += '<p class="text-gray-600">No tournaments available</p>';
            } else {
                const list = document.createElement('ul');
                list.className = 'space-y-2';
                
                tournaments.forEach((tournament: any) => {
                    const item = document.createElement('li');
                    item.className = 'flex justify-between items-center bg-white p-3 rounded shadow';
                    
                    const info = document.createElement('div');
                    info.innerHTML = `
                        <p class="font-semibold">${tournament.name}</p>
                        <p class="text-sm text-gray-600">Players: ${tournament.nb_current_players}/${tournament.nb_max_players}</p>
                    `;
                    
                    const joinBtn = document.createElement('button');
                    joinBtn.className = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded';
                    joinBtn.textContent = 'Join';
                    joinBtn.disabled = tournament.nb_current_players >= tournament.nb_max_players;
                    
                    if (joinBtn.disabled) {
                        joinBtn.className = 'bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed';
                        joinBtn.textContent = 'Full';
                    }
                    
                    joinBtn.addEventListener('click', async () => {
                        await joinTournament(tournament.id, token, userId);
                    });
                    
                    item.appendChild(info);
                    item.appendChild(joinBtn);
                    list.appendChild(item);
                });
                
                tournamentListContainer.appendChild(list);
            }
            
            tournamentListContainer.classList.remove('hidden');

        } catch (err) {
            console.error("Failed to fetch tournaments:", err);
            alert("Failed to load tournaments");
        }
    });
//END#####################################

    createTournamentButton.addEventListener('click', async () => {
        console.log("Bouton cliqué");
        
        if (!selected || selected === "") {
            alert("Please select max number of players");
            return;
        }

        const tournamentName = `Tournament ${Date.now()}`; // Générer nom unique
    
		try {
			const token: string | null = sessionStorage.getItem("jwt");
			const userId: string | null = sessionStorage.getItem("userId");
			if (userId === null || token === null) {
				console.error('Could not fetch user id/token');
				return;
			}

			const res = await fetch(`${route}/tournamentCreate`, {
				method: "POST",
				headers: {
					"authorization": `Bearer ${token}`,
					"x-user-id": userId,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({name: tournamentName, creator_id: userId, nb_max_players: selected})
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
			
			const ws = new WebSocket(`wss${ws_route}/ws`);

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Websocket connection timeout"))
				}, 5000)

				ws.addEventListener('open', (event) => {
					console.log("Connection to server");
					if (ws.readyState === WebSocket.OPEN) {
						const game = {
							creator_id: userId,
							id: response.tournament_id,
							mode: "tournament",
							action: "create"
						};
						console.log("Sending:", game);
						ws.send(JSON.stringify({game, message: "InitSocket"}));
					}
				});
				
				ws.addEventListener('message', (event) => {
					console.log("Response:", event.data);
					const res = JSON.parse(event.data)
					if (res.message === "Initialized") {
						console.log("Connected to server")
						clearTimeout(timeout)
						resolve()
					} else {
						clearTimeout(timeout)
						reject(new Error(res.error))
					}
				});
				
				ws.addEventListener('error', (error) => {
					console.error("WebSocket error:", error);
				});
			})
			// gameLoop(game);
		} catch (err) {
			console.error(err);
		}


	});
};
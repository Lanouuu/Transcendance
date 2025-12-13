const ws_route: string = `://${window.location.host}/tournament`
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
	
	// Ajouter après le h1
	const h1 = tournamentPage.querySelector('h1');
	if (h1) {
		h1.insertAdjacentElement('afterend', select);
		select.insertAdjacentElement('afterend', button);
	} else {
		tournamentPage.appendChild(select);
		tournamentPage.appendChild(button);
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
			const remoteButton: HTMLButtonElement = document.getElementById('gameRemoteGameButton') as HTMLButtonElement;

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
				// console.log(res.text());
				const contentType = res.headers.get("content-type");
				if (!contentType || !contentType.includes("application/json")) {
					const text = await res.text();
					console.error(`Server did not return JSON`, text);
					throw new Error(`Server response is not JSON`);
				}
				
				const game = await res.json();

				// gameLoop(game);
			} catch (err) {
				console.error(err);
		}

        // Choisit wss:// si la page est en HTTPS, sinon ws://
        // const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // const wsUrl = `${protocol}//${window.location.host}/tournament/ws`;
        // const ws = new WebSocket(wsUrl);
		// ws.addEventListener('open', (event) => {
        //     console.log("Connection to server");
		// 	if (ws.readyState === WebSocket.OPEN) {
        //         const message = {
        //             message: "creationTour",
        //             name: tournamentName,
        //             creator_id: 1, // TODO: remplacer par l'ID réel du user connecté
        //             nb_max_players: parseInt(selected)
        //         };
        //         console.log("Sending:", message);
		// 		ws.send(JSON.stringify(message));
        //     }
		// });
        
        // ws.addEventListener('message', (event) => {
        //     console.log("Response:", event.data);
        // });
        
        // ws.addEventListener('error', (error) => {
        //     console.error("WebSocket error:", error);
        // });
	});
};
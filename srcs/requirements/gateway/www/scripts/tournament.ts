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
        
        // Choisit wss:// si la page est en HTTPS, sinon ws://
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/tournament/ws`;
        const ws = new WebSocket(wsUrl);
		ws.addEventListener('open', (event) => {
            console.log("Connection to server");
			if (ws.readyState === WebSocket.OPEN) {
                const message = {
                    message: "creationTour",
                    name: tournamentName,
                    creator_id: 1, // TODO: remplacer par l'ID réel du user connecté
                    nb_max_players: parseInt(selected)
                };
                console.log("Sending:", message);
				ws.send(JSON.stringify(message));
            }
		});
        
        ws.addEventListener('message', (event) => {
            console.log("Response:", event.data);
        });
        
        ws.addEventListener('error', (error) => {
            console.error("WebSocket error:", error);
        });
	});
};
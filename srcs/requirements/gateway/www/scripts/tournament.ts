const ws_route: string = `://${window.location.host}/tournament`;

export async function displayTournamentPage () {

	const createTournamentButton: HTMLButtonElement = document.getElementById('gameTournamentButton') as HTMLButtonElement;
    const selectMaxPlayer: HTMLSelectElement = document.getElementById('tournamentSelectMaxPlayer') as HTMLSelectElement;

    if (!createTournamentButton || !selectMaxPlayer) {
        console.error("Could not get html element");
        return ;
    }

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
        
        const ws = new WebSocket(`ws${ws_route}/ws`);
		ws.addEventListener('open', (event) => {
            console.log("Connection to server");
			if (ws.readyState === WebSocket.OPEN) {
                const message = {
                    message: "creationTour",
                    name: tournamentName,
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
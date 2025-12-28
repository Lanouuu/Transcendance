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

	// POUR TESTER
	let switcher: boolean = false;
	const switcherButton: HTMLButtonElement = document.getElementById("switcher") as HTMLButtonElement;
	if (switcherButton) {
		switcherButton.onclick = async () => {
			if (switcher) {
				await displayTournamentCreation(userId, token);
			}
			else {
				await displayJoinedTournament(userId, token, 'pending', 1);
			}
			switcher = !switcher;
		};
	}

	await displayTournamentCreation(userId, token);

	// #region List //

	const switchButton: HTMLButtonElement = document.getElementById('tournamentListSwitchButton') as HTMLButtonElement;
	let listDisplays: string = 'pending';

	if (!switchButton) {
		console.error("Could not get HTML elements");
		return;
	}

	// AJOUTER LA STRING
	switchButton.onclick = async () => {
		if (listDisplays === 'pending')
			listDisplays = '';
		else if (listDisplays === '')
			listDisplays = 'pending';
		await displayTournamentList(userId, token, listDisplays);
	};

	displayTournamentList(userId, token, listDisplays);

	// #endregion List //
};

// Pour les tournois en local demander a jacky comment ils ont gere le bail
// Comment gerer pour les tournois a noms similaires ?

// Demander ces fonctions:
// - Tester si un user est dans un tournois ou pas (pour afficher le lobby ou la creation)
// - Quitter un tournois
// - Supprimer un tournois (avant de le start)
// - Recuperer les infos d'un tournois avec son ID (pour les infos dans le lobby et savoir si le user est le createur ou non)

// #region Creation // 

async function displayTournamentCreation(userId: string, token: string) {

	const tournamentCreationDiv: HTMLDivElement = document.getElementById("tournamentCreationDiv") as HTMLDivElement;
	const joinedTournamentDiv: HTMLDivElement = document.getElementById("joinedTournamentDiv") as HTMLDivElement;

	const tournamentNameInput: HTMLInputElement = document.getElementById("tournamentNameInput") as HTMLInputElement;

	const fourPlayersButton: HTMLButtonElement = document.getElementById("4PlayersSelectionButton") as HTMLButtonElement;
	const eightPlayersButton: HTMLButtonElement = document.getElementById("8PlayersSelectionButton") as HTMLButtonElement;
	const sixteenPlayersButton: HTMLButtonElement = document.getElementById("16PlayersSelectionButton") as HTMLButtonElement;

	const localSelectionButton: HTMLButtonElement = document.getElementById("localSelectionButton") as HTMLButtonElement;
	const remoteSelectionButton: HTMLButtonElement = document.getElementById("remoteSelectionButton") as HTMLButtonElement;

	const createTournamentButton: HTMLButtonElement = document.getElementById("createTournamentButton") as HTMLButtonElement;

	const tournamentCreationMsg: HTMLDivElement = document.getElementById("tournamentCreationMsg") as HTMLDivElement;

	if (!tournamentCreationDiv || !joinedTournamentDiv
		|| !tournamentNameInput
		|| !fourPlayersButton || !eightPlayersButton || !sixteenPlayersButton
		|| !localSelectionButton || !remoteSelectionButton
		|| !createTournamentButton || !tournamentCreationMsg) {
		console.error("Could not get HTML elements");
		return;
	}

	let maxPlayerSelected = "";

	fourPlayersButton.onclick = () => {
		maxPlayerSelected = "4";
		fourPlayersButton.classList.add('outline', 'outline-accent');
		eightPlayersButton.classList.remove('outline', 'outline-accent');
		sixteenPlayersButton.classList.remove('outline', 'outline-accent');
	}

	eightPlayersButton.onclick = () => {
		maxPlayerSelected = "8";
		eightPlayersButton.classList.add('outline', 'outline-accent');
		fourPlayersButton.classList.remove('outline', 'outline-accent');
		sixteenPlayersButton.classList.remove('outline', 'outline-accent');
	}

	sixteenPlayersButton.onclick = () => {
		maxPlayerSelected = "16";
		sixteenPlayersButton.classList.add('outline', 'outline-accent');
		eightPlayersButton.classList.remove('outline', 'outline-accent');
		fourPlayersButton.classList.remove('outline', 'outline-accent');
	}

	let modeSelected = "";
	localSelectionButton.onclick = () => {
		modeSelected = "local";
		localSelectionButton.classList.add('outline', 'outline-accent');
		remoteSelectionButton.classList.remove('outline', 'outline-accent');
	};
	remoteSelectionButton.onclick = () => {
		modeSelected = "remote";
		remoteSelectionButton.classList.add('outline', 'outline-accent');
		localSelectionButton.classList.remove('outline', 'outline-accent');
	};

	createTournamentButton.onclick = async () => {
		const tournamentName = tournamentNameInput.value.trim();
		if (!tournamentName) {
			displayMsg(tournamentCreationMsg, "Please chose a name for the tournament", "red");
			return;
		}
		if (maxPlayerSelected !== "4" && maxPlayerSelected !== "8" && maxPlayerSelected !== "16") {
			displayMsg(tournamentCreationMsg, "Please select the max player number option", "red");
			return;
		}
		if (modeSelected !== "local" && modeSelected !== "remote") {
			displayMsg(tournamentCreationMsg, "Please select a mode for the tournament", "red");
			return;
		}
		await createTournament(userId, token, tournamentName, maxPlayerSelected, modeSelected, tournamentCreationMsg);
	};

	joinedTournamentDiv.classList.add('hidden');
	tournamentCreationDiv.classList.remove('hidden');
}

async function createTournament(userId: string, token: string, tournamentName: string, maxPlayerSelected: string, tournamentMode: string, msg: HTMLDivElement) {

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
			displayJoinedTournament(userId, token, tournamentMode, response.tournament_id);
		}
		else {
			displayMsg(msg, "Tournament creation failed", "red");
		}
	} catch (err) {
		console.error(err);
	}
}

// #endregion Creation // 

// #region Joined //

async function displayJoinedTournament(userId: string, token: string, mode: string, tournament_id: number) {

	const tournamentCreationDiv: HTMLDivElement = document.getElementById("tournamentCreationDiv") as HTMLDivElement;
	const joinedTournamentDiv: HTMLDivElement = document.getElementById("joinedTournamentDiv") as HTMLDivElement;
	const nameDiv: HTMLDivElement = document.getElementById("joinedTournamentName") as HTMLDivElement;
	const playerRatioDiv: HTMLDivElement = document.getElementById("joinedTournamentPlayerRatio") as HTMLDivElement;
	const modeDiv: HTMLDivElement = document.getElementById("joinedTournamentMode") as HTMLDivElement;
	const statusDiv: HTMLDivElement = document.getElementById("joinedTournamentStatus") as HTMLDivElement;
	const creatorDiv: HTMLDivElement = document.getElementById("joinedTournamentCreator") as HTMLDivElement;
	const participantsUl: HTMLUListElement = document.getElementById("joinedTournamentParticipants") as HTMLUListElement;
	const adminDiv: HTMLDivElement = document.getElementById("tournamentAdminDiv") as HTMLDivElement;
	const leaveButton: HTMLButtonElement = document.getElementById("leaveTournamentButton") as HTMLButtonElement;
	const deleteButton: HTMLButtonElement = document.getElementById("deleteTournamentButton") as HTMLButtonElement;
	const startButton: HTMLButtonElement = document.getElementById("startTournamentButton") as HTMLButtonElement;
	const msgDiv: HTMLDivElement = document.getElementById("joinedTournamentMsg") as HTMLDivElement;

	if (!tournamentCreationDiv || !joinedTournamentDiv
		|| !nameDiv || !playerRatioDiv || !modeDiv || !statusDiv
		|| !creatorDiv || !participantsUl || !leaveButton
		|| !adminDiv || !deleteButton || !startButton
		|| !msgDiv) {
		console.error("Could not get HTML elements");
		return;
	}

	try {
		// tournament_id
		const res = await fetch(`${route}/get-infos`, {

		});

		if (!res.ok) {

		}

		const data = await res.json();

		nameDiv.textContent = "";
		playerRatioDiv.textContent = "";
		modeDiv.textContent = "";
		statusDiv.textContent = "";
		creatorDiv.textContent = "";

		// const frag: DocumentFragment = document.createDocumentFragment();
		// // Creer un tableau avec chaque nom de participant

		// for (userName of participants) {
		// 	const li: HTMLLIElement = document.createElement('li');
		// 	li.className = "";
		// 	li.textContent = userName;
		// 	frag.appendChild(li);
		// }
		// participantsUl.appendChild(frag);

		if (data.creator_id === userId) {
			leaveButton.classList.add('hidden');
			startButton.classList.remove('hidden');
			deleteButton.classList.remove('hidden');
		}
		else {
			leaveButton.classList.remove('hidden');
			startButton.classList.add('hidden');
			deleteButton.classList.add('hidden');
		}

		leaveButton.onclick = async () => {
			leaveTournament(userId, token, msgDiv);
		};

		startButton.onclick = async () => {
			startTournament(userId, token, msgDiv);
		};

		deleteButton.onclick = async () => {
			deleteTournament(userId, token, msgDiv);
		};

	} catch (error) {

	}

	tournamentCreationDiv.classList.add('hidden');
	joinedTournamentDiv.classList.remove('hidden');
}

async function startTournament(userId: string, token: string, msg: HTMLDivElement) {
	try {
		if (!confirm('Are you sure you want to start the tournament?')) {
			return;
		}

		const res = await fetch(`${route}/tournamentStart`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId,
			}
		});

		if (!res.ok) {
		    const errorText = await res.json();
		    console.error(`Server error ${res.status}:`, errorText.error);
			displayMsg(msg, "Error starting tournament", "red");
		}
		console.log("Tournament started successfully!");
		displayMsg(msg, "Tournament started successfully", "green");
	} catch (err) {
		console.error("Failed to start tournament:", err);
		alert(`Error starting tournament: ${err}`);
	}
}

async function deleteTournament(userId: string, token: string, msg: HTMLDivElement) {

}

async function leaveTournament(userId: string, token: string, msg: HTMLDivElement) {

}

// #endregion Joined //

// #region List // 

async function displayTournamentList(userId: string, token: string, wantedStatus: string) {
	const tournamentTitle: HTMLUListElement = document.getElementById("tournamentListTitle") as HTMLUListElement;
	const tournamentList: HTMLUListElement = document.getElementById("tournamentListUl") as HTMLUListElement;
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
			return;
		}

		const tournaments = await res.json();
		console.log("Tournaments:", tournaments);
		if (tournaments.length <= 0) {
			tournamentList.textContent = "No tournaments available"
			return;
		}
		tournamentList.innerHTML = "";
		tournaments.forEach(async (tournament: any) => {

			if (tournament.mode !== 'remote' || tournament.status !== wantedStatus) return;

			const li: HTMLLIElement = document.createElement('li');
			li.className = "h-[48%] w-[48%] grid grid-cols-[9fr_1fr] p-3 outline outline-dark rounded-2xl bg-dark";

			const infoDiv: HTMLDivElement = document.createElement('div');
			infoDiv.className = "col-span-1 h-full w-full flex flex-row items-center justify-evenly relative min-w-0";

			const tournamentNameDiv: HTMLDivElement = document.createElement('div');
			tournamentNameDiv.className = "w-3/4 text-xl text-center min-w-0 truncate";
			tournamentNameDiv.textContent = tournament.name;

			infoDiv.append(tournamentNameDiv);

			const winnerNameDiv:	HTMLDivElement = document.createElement('div');
			winnerNameDiv.className = "";
			if (wantedStatus === "finished" && tournament.status === "finished") {
				const res = await fetch(`${window.location.origin}/users/get-user/${tournament.winner_id}`, {

				});

				if (res.ok) winnerNameDiv.textContent = `Winner: ${tournament.winner_id}`;
				else 		winnerNameDiv.textContent = "Winner: ?";
				infoDiv.append(winnerNameDiv);
			}

			const joinButton: HTMLButtonElement = document.createElement('button');
			joinButton.className = 'col-span-1 w-fit bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded';
			joinButton.textContent = `Join\n${tournament.nb_current_players}/${tournament.nb_max_players}`;
			joinButton.disabled = tournament.nb_current_players >= tournament.nb_max_players;
			joinButton.onclick = async () => { await joinTournament(tournament.id, token, userId); };
			if (joinButton.disabled) {
				if (tournament.status === "finished") joinButton.textContent = "Finished";
				else joinButton.textContent = 'Full';
			}

			li.append(infoDiv, joinButton);
			frag.appendChild(li);
		});
		tournamentList.appendChild(frag);

	} catch (error) {
		console.error("Failed to load Tournament list:", error);
		return;
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

// #endregion List // 

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
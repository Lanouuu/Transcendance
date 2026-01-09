import { gameLoop } from './game.js'
import { Game } from "./gameClass.js"
import { displayNextMatch } from './game.js'
const ws_route: string = `://${window.location.host}/game`
const route: string = `${window.location.origin}/tournament`;
const gameRoute: string = `${window.location.origin}/game`;

async function checkToken(): Promise<boolean> {
	const token = sessionStorage.getItem("jwt");
	if (!token) {
		return false;
	}
	try {
		const response = await fetch(`${window.location.origin}/auth_service/verify`, {
			headers: { "Authorization": `Bearer ${token}` }
		});
		if (!response.ok) {
			return false;
		}
		return true;
	} catch (error) {
		console.error("Auth check failed:", error);
		return false;
	}
}

export async function displayTournamentPage() {

	const loginRedirectButtonDiv: HTMLDivElement = document.getElementById('loginRedirectButtonDiv') as HTMLDivElement;
	const loginRedirectButton: HTMLButtonElement = document.getElementById('loginRedirectButton') as HTMLButtonElement;

	const isOnline = await checkToken();
	if (!isOnline) {
		loginRedirectButtonDiv.classList.remove('hidden');
		loginRedirectButtonDiv.classList.add('flex');
		loginRedirectButton.addEventListener('click', async () => {
		window.location.hash = "#login";
	});
	} else {

		const tournamentPage: HTMLDivElement = document.getElementById('tournamentPage') as HTMLDivElement;
		tournamentPage.classList.remove('hidden');
		const userId: string | null = sessionStorage.getItem("userId");
		const token: string | null = sessionStorage.getItem("jwt");

		if (userId === null || token === null) {
			console.error('Could not fetch user id/token');
			return;
		}
		// #region Left //

		const joinedTournamentInfo: {tournamentId: number | undefined, isRegistered: boolean} = await isInTournament(userId, token);
		if (joinedTournamentInfo.isRegistered && joinedTournamentInfo.tournamentId !== undefined) {
			displayJoinedTournament(userId, token, joinedTournamentInfo.tournamentId);
			console.log("Player is in tournament: id = ", joinedTournamentInfo.tournamentId);
		}
		else {
			displayTournamentCreation(userId, token);
			console.log("User not in tournament")
		}

		// #endregion Left //

		// #region Right //

		const switchButton: HTMLButtonElement = document.getElementById('tournamentListSwitchButton') as HTMLButtonElement;
		const switchButtonIcon: HTMLImageElement = document.getElementById('tournamentListSwitchButtonIcon') as HTMLImageElement;
		let listDisplays: string = 'pending';

		if (!switchButton || !switchButtonIcon) {
			console.error("Could not get HTML elements");
			return;
		}
		displayTournamentList(userId, token, listDisplays);
		switchButton.onclick = async () => {
			if (listDisplays === 'pending') {
				listDisplays = 'finished';
				switchButtonIcon.classList.add('rotate-[360deg]');
			}
			else if (listDisplays === 'finished') {
				switchButtonIcon.classList.remove('rotate-[360deg]');
				listDisplays = 'pending';
			}
			await displayTournamentList(userId, token, listDisplays);
			// setTimeout(() => {switchButtonIcon.classList.remove('rotate-[360deg]');}, 500);
		};
	}

	// #endregion Right //
};

// Faire en sorte que les user pas connectes puissent quand meme lancer un tournois local

// Demander ces fonctions:
// - Quitter un tournois
// - Supprimer un tournois (avant de le start)

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
// Checker alias unique
async function displayTournamentAlias(tournamentMode: string, maxPlayer: string): Promise<string[]> {
	const creationDiv:	HTMLDivElement = document.getElementById('tournamentCreationDiv') as HTMLDivElement;
	const aliasDiv:		HTMLDivElement = document.getElementById('tournamentAliasDiv') as HTMLDivElement;
	const inputDiv:		HTMLDivElement = document.getElementById('aliasInputDiv') as HTMLDivElement;
	let	realMaxPlayer:	number = Number(maxPlayer);

	creationDiv.classList.add('hidden');
	aliasDiv.classList.remove('hidden');

	if (tournamentMode === 'remote') realMaxPlayer = 1;

	aliasDiv.innerHTML = "";
	const inputList: HTMLInputElement[] = [];
	for (let i = 0; i < Number(realMaxPlayer); i++) {
		const input = document.createElement('input');
		input.className = `w-4/6 p-2
                        shadow-[inset_3px_3px_6px_rgba(0,0,0,0.5),_inset_-3px_-3px_6px_rgba(255,255,255,0.1)]
                        focus:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.6),_inset_-4px_-4px_8px_rgba(255,255,255,0.1)]
                        rounded-xl 
                        bg-dark bg-opacity-60 focus:outline-none 
                        text-white font-geo`;
		input.type = 'text';
		input.placeholder = `Alias joueur ${i + 1}`;

		inputDiv.appendChild(input)
		inputList.push(input);
	}

	aliasDiv.appendChild(inputDiv);

	const confirmButton = document.createElement('button');
	confirmButton.className = `mx-auto 
                    py-3 w-4/6 rounded-xl 
                    bg-prim bg-opacity-90 hover:bg-opacity-100 
                    text-white font-semibold font-geo
                    shadow-[inset_0_4px_6px_rgba(255,255,255,0.15),_3px_3px_6px_rgba(0,0,0,0.6),_-3px_-3px_6px_rgba(255,255,255,0.1)]
                    hover:shadow-[inset_0_5px_7px_rgba(255,255,255,0.2),_4px_4px_10px_rgba(0,0,0,0.7),_-4px_-4px_10px_rgba(255,255,255,0.1)]`;
	confirmButton.textContent = "Confirm";
	aliasDiv.appendChild(confirmButton);

	return (new Promise<string[]>((resolve) => {
		confirmButton.onclick = () => {
			const values = inputList.map(input => input.value.trim());
			if (values.every(val => val.length > 0)) {
				aliasDiv.classList.add('hidden');
				resolve(values);
			}
			else {

			}
		};
	}));
}

async function createTournament(userId: string, token: string, tournamentName: string, maxPlayerSelected: string, tournamentMode: string, msg: HTMLDivElement) {

	let	aliasArray:	string[] = await displayTournamentAlias(tournamentMode, maxPlayerSelected);
	console.log("AliasArray = ", aliasArray);
	// Envoyer l'alias

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
			displayMsg(msg, text.error, "red");
			return;
		}

		const contentType = res.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			const text = await res.json();
			console.error(`Server did not return JSON`, text.error);
			displayMsg(msg, text.error, "red");
			return;
		}

		const response = await res.json();

		if (response.message === "Success") {
			const res1 = await fetch(`${gameRoute}/tournamentAlias`, {
				method: "POST",
				headers: {
					"authorization": `Bearer ${token}`,
					"x-user-id": userId,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ alias: aliasArray[0] }) // Envoyer l'alias dans le body
			});

			if (!res1.ok) {
				const error = await res1.json();
				throw new Error(error.error || "Failed to join tournament");
			}

			const response1 = await res1.json();

            gameLoop(parseInt(response.id, 10), response.tournament_id, "initTournament", parseInt(userId, 10));
			displayMsg(msg, "Tournament created", "green");
			displayJoinedTournament(userId, token, Number(response.tournament_id));
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

async function displayJoinedTournament(userId: string, token: string, tournament_id: number) {

	const tournamentCreationDiv: HTMLDivElement = document.getElementById("tournamentCreationDiv") as HTMLDivElement;
	const tournamentListDiv: HTMLDivElement = document.getElementById('tournamentListDiv') as HTMLDivElement;
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

	if (!tournamentCreationDiv || !joinedTournamentDiv || !tournamentListDiv
		|| !nameDiv || !playerRatioDiv || !modeDiv || !statusDiv
		|| !creatorDiv || !participantsUl || !leaveButton
		|| !adminDiv || !deleteButton || !startButton
		|| !msgDiv) {
		console.error("Could not get HTML elements");
		return;
	}

	try {
		const data = await getTournamentInfo(userId, token, String(tournament_id), msgDiv);

		if (!data) throw new Error("Could not fetch tournament infos");

		nameDiv.textContent = data.tournament.name;

		const resCreatorName = await fetch(`${window.location.origin}/users/get-user/${data.tournament.creator_id}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			}
		});

		const dataCreator = await resCreatorName.json();

		if (!resCreatorName.ok) creatorDiv.textContent = `Created by: <unknown>`;
		else creatorDiv.textContent = `Created by: ${dataCreator.name}`;
		modeDiv.textContent = `Mode: ${data.tournament.mode}`;
		statusDiv.textContent = `Status: ${data.tournament.status}`;
		playerRatioDiv.textContent = `${data.tournament.nb_current_players}/${data.tournament.nb_max_players}`;

		const frag: DocumentFragment = document.createDocumentFragment();
		const participantsArray: string[] = createParticipantsArray(data.tournament.players_names);


		for (let userName of participantsArray) {
			const li: HTMLLIElement = document.createElement('li');
			li.className = "min-w-0 truncate";
			li.textContent = userName;
			frag.appendChild(li);
		}
		participantsUl.appendChild(frag);

		if (data.tournament.creator_id === userId) {
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
			leaveTournament(userId, token, String(tournament_id), msgDiv);
			window.location.hash = '#tournament';
			window.dispatchEvent(new Event('hashchange'));
		};

		startButton.onclick = async () => {
			startTournament(userId, token, msgDiv);
		};

		deleteButton.onclick = async () => {
			deleteTournament(userId, token, String(tournament_id), msgDiv);
			window.location.hash = '#tournament';
			window.dispatchEvent(new Event('hashchange'));
		};

	} catch (error) {
		console.error("Error getting tournament info", error);
		return ;
	}

	tournamentCreationDiv.classList.add('hidden');
	tournamentListDiv.classList.add('hidden');
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

// Envoie une string de l'id du tournois via le body
async function deleteTournament(userId: string, token: string, tournamentId: string, msg: HTMLDivElement) {
	try {
		const res = await fetch(`${route}/deleteTournament`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({tournament_id: tournamentId})
		})
		if (!res.ok){
			console.error('Failed to delete tournament');
			displayMsg(msg, "Failed to delete tournament", "red");
			return ;
		}
	} catch (error) {
		console.error('Fetch failed to deleteTournament');
		displayMsg(msg, "Failed to fetch deleteTournament", "red");
	}
}

// Envoie une string de l'id du tournois via le body
async function leaveTournament(userId: string, token: string, tournamentId: string, msg: HTMLDivElement) {
	try {
		const res = await fetch(`${route}/leaveTournament`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({tournament_id: tournamentId})
		})
		if (!res.ok){
			console.error('Failed to leave tournament');
			displayMsg(msg, "Failed to leave tournament", "red");
			return ;
		}
	} catch (error) {
		console.error('Fetch failed to leaveTournament');
		displayMsg(msg, "Failed to fetch leaveTournament", "red");
	}
}

// #endregion Joined //

// #region List // 

async function displayTournamentList(userId: string, token: string, wantedStatus: string) {
	const tournamentTitle: HTMLUListElement = document.getElementById("tournamentListTitle") as HTMLUListElement;
	const tournamentList: HTMLUListElement = document.getElementById("tournamentListUl") as HTMLUListElement;
	const tournamentListMsg: HTMLDivElement = document.getElementById("tournamentListMsg") as HTMLDivElement;
	const frag: DocumentFragment = document.createDocumentFragment();

	if (!tournamentTitle || !tournamentList || !tournamentListMsg) {
		console.error("Could not get HTML elements");
		return;
	}
	const title: string = wantedStatus.charAt(0).toUpperCase() + wantedStatus.slice(1);
	tournamentTitle.textContent = title;

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
			if (wantedStatus === "finished") {
				const winnerNameDiv:	HTMLDivElement = document.createElement('div');
				winnerNameDiv.className = "font-geo";
				winnerNameDiv.textContent = `🏆 ${tournament.winner_alias}`;

				infoDiv.append(winnerNameDiv);
				li.append(infoDiv);
			} else {
				const joinButton: HTMLButtonElement = document.createElement('button');
				joinButton.className = 'col-span-1 w-fit min-w-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded';
				joinButton.textContent = `Join\n${tournament.nb_current_players}/${tournament.nb_max_players}`;
				joinButton.disabled = tournament.nb_current_players >= tournament.nb_max_players;
				joinButton.onclick = async () => { await joinTournament(tournament.id, token, userId, tournamentListMsg); };
				if (joinButton.disabled) {
					if (tournament.status === "finished") joinButton.textContent = "Finished";
					else joinButton.textContent = 'Full';
				}

				li.append(infoDiv, joinButton);
			}	
			frag.appendChild(li);
		});
		tournamentList.appendChild(frag);

	} catch (error) {
		console.error("Failed to load Tournament list:", error);
		return;
	}
}

async function joinTournament(tournamentId: number, token: string, userId: string, msg: HTMLDivElement) {

	let	aliasArray:	string[] = await displayTournamentAlias('remote', '1');
	console.log("AliasArray = ", aliasArray);
	// Envoyer l'alias

	try {
		const res = await fetch(`${route}/tournamentJoin`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ idTour: tournamentId }) // Envoyer l'alias dans le body
		});

		if (!res.ok) {
			const error = await res.json();
			throw new Error(error.error || "Failed to join tournament");
		}

		const response = await res.json();

		displayJoinedTournament(userId, token, tournamentId);
		displayMsg(msg, "Successfully joined tournament", "green");

		if (response.message === "Success") {
			const res1 = await fetch(`${gameRoute}/tournamentAlias`, {
				method: "POST",
				headers: {
					"authorization": `Bearer ${token}`,
					"x-user-id": userId,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ alias: aliasArray[0] }) // Envoyer l'alias dans le body
			});

			if (!res1.ok) {
				const error = await res1.json();
				throw new Error(error.error || "Failed to join tournament");
			}

			const response1 = await res1.json();

            gameLoop(parseInt(response.id, 10), response.tournament_id, "initTournament", parseInt(userId, 10));
		}
	} catch (err) {
		console.error("Failed to join tournament:", err);
		displayMsg(msg, `${err}`, "red");
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

async function isInTournament(userId: string, token: string): Promise<{tournamentId: number | undefined, isRegistered: boolean}> {
	try {
	
		const res = await fetch(`${route}/isInTournament`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId,
			},
		});
		const data = await res.json();
		if (!res.ok) {
			console.error("Error looking up tournament registration");
			return (data);
		}
		return (data);
		
	} catch (error) {
		console.error("Error fetching isInTournament:", error);
		return ({tournamentId: undefined, isRegistered: false});
	}
}

async function getTournamentInfo(userId: string, token: string, tournamentId: string, msg: HTMLDivElement): Promise<any | null> {
	try {
	
		const res = await fetch(`${route}/getTournamentInfo/${tournamentId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId,
			},
		});
		const data = await res.json();
		if (!res.ok) {
			console.error("Error getting tournament infos:", data.error);
			displayMsg(msg, data.error, "red");
			return (null);
		}
		return (data);
		
	} catch (error) {
		console.error("Error fetching getTournamentInfo:", error);
		return (null);
	}
}

function createParticipantsArray(partString: string): string[] {
	let array: string[];

	array = partString.split(",", 16);

	console.log("Participants:", array);

	return (array);
}
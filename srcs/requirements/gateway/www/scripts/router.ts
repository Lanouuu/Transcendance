import { launchInvitGame } from "./game.js";

const PAGE_BACKGROUNDS: Record<string, string> = {
	'account': '/img/Background1.png',
	'editProfile': '/img/Background1.png',
	'error': '/img/Background1.png',
	'game': '/img/Background1.png',
	'home': '/img/Background2.png',
	'login': '/img/Background1.png',
	'logout': '/img/Background1.png',
	'signup': '/img/Background1.png',
	'tournament': '/img/Background1.png',
};

// permet de recuperer l'ID et le Token depuis la connection oAuth 42
// et redirige vers account
// utiliser juste avant new Router() a la fin
function handleOauth42Redirect() {
	const params = new URLSearchParams(window.location.hash.split("?")[1]);
	const token = params.get("token");
	const id = params.get("id");

	if (token && id) {
		sessionStorage.setItem("jwt", token);
		sessionStorage.setItem("userId", id);

		document.body.classList.add("loggedIn");

		window.dispatchEvent(new Event('user:login'));

		window.location.hash = "#account";
	}
}

const PAGE_ORDER: string[] = ['home', 'game', 'tournament', 'account', 'logout', 'signup', 'login'];

class Router {

	private mainContent: HTMLElement;
	private currentBgUrl: string;
	private currentPage: string;
	private heartBeatInterval: number | null = null;
	private BASE_URL: string = `https://localhost:8443/`; // A modifier

	constructor() {
		// Selects the part of the html doc we want to update (?)
		this.mainContent = document.querySelector('main') as HTMLElement;
		this.currentBgUrl = PAGE_BACKGROUNDS['home'];
		this.currentPage = 'home';
		// Launches the chain of function 
		this.initRouter();
	}


	private sanitizeHTML(html: string): string {
		// Supprimer tous les <script>
		html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

		// Supprimer tous les event handlers (onclick, onerror, onload, etc.)
		html = html.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
		html = html.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');

		// Supprimer javascript: dans les URLs
		html = html.replace(/javascript:/gi, '');

		// Supprimer data: urls (peuvent contenir du JS)
		html = html.replace(/data:text\/html/gi, '');

		return html;
	}

	private async checkAuth(): Promise<boolean> {
		const token = sessionStorage.getItem("jwt");

		if (!token) {
			return false;
		}

		try {
			const response = await fetch(`${this.BASE_URL}auth_service/verify`, {
				headers: { "Authorization": `Bearer ${token}` }
			});

			if (!response.ok) {
				this.cleanupSession();
				return false;
			}

			return true;

		} catch (error) {
			console.error("Auth check failed:", error);
			this.cleanupSession();
			return false;
		}
	}

	async checkGuest(): Promise<boolean> {
		const token = sessionStorage.getItem("jwt");

		if (!token) {
			return false;
		}

		try {
			const response = await fetch(`${this.BASE_URL}users/is-guest`, {
				method: "GET",
				headers: { "Authorization": `Bearer ${token}` }
			});

			if (!response.ok) {
				this.cleanupSession();
				return false;
			}

			const data = await response.json();

			if (data.isGuest)
				return true;
			else
				return false;

		} catch (error) {
			console.error("Auth check failed:", error);
			this.cleanupSession();
			return false;
		}
	}

	private cleanupSession(): void {
		sessionStorage.removeItem("jwt");
		sessionStorage.removeItem("userId");
		sessionStorage.removeItem("accountActiveTab");
		document.body.classList.remove("loggedIn");
		window.dispatchEvent(new Event("user:logout"));
	}

	private async initRouter(): Promise<void> {

		// First load (supposed to launch main i guess)
		this.handleRoute();

		window.addEventListener('hashchange', () => this.handleRoute());

		window.addEventListener('user:login', () => this.startHeartbeat());
		window.addEventListener('user:logout', () => this.stopHeartbeat());

		// 		window.addEventListener('storage', (ev: StorageEvent) => {
		//			if (ev.key === 'jwt') {
		//				if (sessionStorage.getItem('jwt')) this.startHeartbeat();
		//				else this.stopHeartbeat();
		//			}
		//		});
		// 		Potentiellement juste dispatch un event user:login ou logout en fonction et laisser ceux du haut gerer le bordel

		if (sessionStorage.getItem("jwt") && sessionStorage.getItem("userId"))
			this.startHeartbeat();
	}

	private startHeartbeat(): void {

		if (this.heartBeatInterval !== null) return;

		const sendHeartbeat = async () => {
			const token = sessionStorage.getItem("jwt");
			const userId = sessionStorage.getItem("userId");
			if (!token || !userId) return;
			try {
				await fetch(`${this.BASE_URL}/users/heartbeat`, {
					method: "POST",
					headers: {
						"authorization": `Bearer ${token}`,
						"x-user-id": userId,
					},
				});
				console.log(`Heartbeat send for userId: ${userId}`);
			} catch (error) {
				console.debug("Heartbeat failed", error);
			}
		};

		void sendHeartbeat();
		this.heartBeatInterval = window.setInterval(sendHeartbeat, 20_000);
	}

	private stopHeartbeat(): void {
		if (this.heartBeatInterval !== null) {
			clearInterval(this.heartBeatInterval);
			this.heartBeatInterval = null;
		}
	}

	// Gets called each time the hash (#) changes (?)
	// Get the name of the page clean and call loadPage
	private handleRoute(): void {

		const fullHash = window.location.hash.slice(1) || 'home';
		const page = fullHash.split('?')[0];
		this.loadPage(page);
	}

	private getTransitionDirection(page: string): string {
		const nextPageIndex: number = PAGE_ORDER.indexOf(page);
		const currentPageIndex: number = PAGE_ORDER.indexOf(this.currentPage);

		if (currentPageIndex < nextPageIndex)
			return 'right';
		else
			return 'left';
	}

	private async animateBgTransition(nextBgUrl: string, transitionDirection: string): Promise<void> {

		if (nextBgUrl === this.currentBgUrl) return;

		const currentBgContainer: HTMLElement = document.getElementById('backgroundContainer') as HTMLElement;
		const nextBgContainer: HTMLElement = document.getElementById('backgroundNext') as HTMLElement;

		if (!currentBgContainer || !nextBgContainer) {
			console.error('Could not find background containers');
			return;
		}

		nextBgContainer.style.backgroundImage = `url('${nextBgUrl}')`;
		nextBgContainer.style.transition = 'none';

		// On gere le translate de next en fonction de isRightTransition
		if (transitionDirection === 'right') {
			nextBgContainer.classList.remove('-translate-x-full', 'translate-x-0');
			nextBgContainer.classList.add('translate-x-full')
		} else {
			nextBgContainer.classList.remove('translate-x-full', 'translate-x-0');
			nextBgContainer.classList.add('-translate-x-full')
		}

		// Force un reflow pour eviter que le nav skip l'anim
		// Ca ne fait rien d'autre
		void nextBgContainer.offsetWidth;

		nextBgContainer.style.transition = '';

		void currentBgContainer.offsetWidth;
		void nextBgContainer.offsetWidth;

		// Ajout et retrait de classe --> Animation
		if (transitionDirection === 'right') {

			currentBgContainer.classList.add('-translate-x-full', 'bgTransiBlur');
			nextBgContainer.classList.remove('translate-x-full');
			nextBgContainer.classList.add('translate-x-0', 'bgTransiBlur');
		} else {

			currentBgContainer.classList.add('translate-x-full', 'bgTransiBlur');
			nextBgContainer.classList.remove('-translate-x-full');
			nextBgContainer.classList.add('translate-x-0', 'bgTransiBlur');
		}

		// On wait que l'animation se termine
		await new Promise(resolve => setTimeout(resolve, 1000));

		// On retire les animations
		currentBgContainer.style.transition = 'none';
		nextBgContainer.style.transition = 'none';

		// On update l'image (le current est mtn le next) et on remet tout en place
		currentBgContainer.style.backgroundImage = `url('${nextBgUrl}')`;
		currentBgContainer.classList.remove('-translate-x-full', 'translate-x-full', 'bgTransiBlur');
		nextBgContainer.classList.remove('translate-x-0', '-translate-x-full', 'translate-x-full', 'bgTransiBlur');
		nextBgContainer.style.backgroundImage = '';

		// Force reflow
		void currentBgContainer.offsetWidth;
		void nextBgContainer.offsetWidth;

		// On remet les animations
		currentBgContainer.style.transition = '';
		nextBgContainer.style.transition = '';

		// Update de l'url dans la structure
		this.currentBgUrl = nextBgUrl;
	}

	// Fetch the correct html file to update the <main> of index.html
	// Load scripts related to the page
	private async loadPage(page: string): Promise<void> {

		try {

			if (page === 'error') {
				const params = new URLSearchParams(window.location.hash.split('?')[1]);
				const errorCode = params.get('code');
				this.displayError(errorCode || '500');
				this.currentPage = 'error';
				return;
			}

			const needsAuth = ['account', 'editProfile', 'logout'];
			const isAuthPage = ['login', 'signup'];


			const isAuthenticated = await this.checkAuth();
			const isGuest = await this.checkGuest();

			if (isAuthenticated && isGuest && needsAuth.includes(page)) {
				this.displayError('401');
				return;
			}

			if (isAuthenticated && !isGuest && isAuthPage.includes(page)) {
				window.location.hash = '#account';
				return;
			}

			if (!isAuthenticated && needsAuth.includes(page)) {
				this.displayError('401');
				return;
			}

			if (!PAGE_BACKGROUNDS[page] && page !== 'error') {
				this.displayError('404');
				this.currentPage = 'error';
				return;
			}

			const nextBackgroundUrl: string = PAGE_BACKGROUNDS[page] || PAGE_BACKGROUNDS['home'];
			const transitionDirection: string = this.getTransitionDirection(page);
			// await this.animateBgTransition(nextBackgroundUrl, transitionDirection);

			// Fetch the file corresponding to the attribute page
			// Then gets its content as a text in the variabe content
			const response = await fetch(`/pages/${page}.html`);
			if (!response.ok) throw new Error(`Page ${page} not found`);
			const content = await response.text();

			// Updates the <main> of index.html
			this.mainContent.innerHTML = this.sanitizeHTML(content);

			this.currentPage = page;

			// Attendre plus longtemps pour laisser le DOM se mettre à jour
			await new Promise(resolve => setTimeout(resolve, 50));

			// Loads the scripts corresponding the the page loaded
			switch (page) {
				case 'home':
					const homeScript = await import('./home.js'); // on peut mettre ca en haut
					if (homeScript.home) homeScript.home();
					break;
				case 'game':
					const gameScript = await import('./game.js')
					if (gameScript.setupGamePage) gameScript.setupGamePage();
					break;
				case 'tournament':
					const tournamentScript = await import('./tournament.js');
					if (tournamentScript.displayTournamentPage) tournamentScript.displayTournamentPage();
					break;
				case 'account':
					const accountScript = await import('./account.js');
					if (accountScript.displayAccountPage) accountScript.displayAccountPage();
					break;
				case 'editProfile':
					const editProfileScript = await import('./editProfile.js');
					if (editProfileScript.editProfile) editProfileScript.editProfile();
					break;
				case 'signup':
					const signupScript = await import('./signup.js');
					if (signupScript.signup) signupScript.signup();
					break;
				case 'login':
					const loginScript = await import('./login.js');
					if (loginScript.login) loginScript.login();
					break;
				case 'logout':
					const logoutScript = await import('./logout.js');
					if (logoutScript.logout) logoutScript.logout();
					break;
				default:
					break;
			}
		} catch (error) {
			console.error('Error loading page: ', error);
			this.mainContent.innerHTML = this.sanitizeHTML('<h1>Page not found</h1>'); // A changer ?
		}
	}

	private displayError(code: string): void {

		const validCodes = ['400', '401', '403', '404'];
		let safeCode;
		if (validCodes.includes(code)) {
			safeCode = code;
		} else {
			safeCode = '400'
		}

		const errorMessages: Record<string, { title: string, message: string }> = {
			'400': {
				title: 'Bad Request',
				message: 'The server could not process the request due to a client error.'
			},
			'401': {
				title: 'Unauthorized',
				message: 'You need to be logged in to access this page.'
			},
			'403': {
				title: 'Forbidden',
				message: 'You do not have permission to access this resource.'
			},
			'404': {
				title: 'Page Not Found',
				message: 'This is not the web page you are looking for'
			}
		};

		const error = errorMessages[safeCode];

		this.mainContent.innerHTML = `
			<div class="flex flex-col 
				items-center justify-center 
				min-h-[60vh] 
				text-center 
				font-geo text-base">

				<h1 class="text-6xl font-bold text-red-500 mb-4">${safeCode}</h1>

				<h2 class="text-3xl font-semibold mb-4">${error.title}</h2>

				<p class="text-xl mb-8">${error.message}</p>

				<a href="#${safeCode === '401' ? 'login' : 'home'}" 
					class="mx-auto py-3 w-40
                		rounded-xl
                		bg-prim bg-opacity-90 hover:bg-opacity-100
                		text-white font-semibold font-geo
                		shadow-[inset_0_4px_6px_rgba(255,255,255,0.15),_3px_3px_6px_rgba(0,0,0,0.6),_-3px_-3px_6px_rgba(255,255,255,0.1)]
                		hover:shadow-[inset_0_5px_7px_rgba(255,255,255,0.2),_4px_4px_10px_rgba(0,0,0,0.7),_-4px_-4px_10px_rgba(255,255,255,0.1)]
                		transition">
					${safeCode === '401' ? 'Return to Login' : 'Return to Home'}
				</a>

			</div>
		`;
	}

}


async function notificationHandler(): Promise<void> {

	const userId: string | null = sessionStorage.getItem("userId");
	const token: string | null = sessionStorage.getItem("jwt");

	const notifBubbleDiv: HTMLDivElement = document.getElementById("notifBubble") as HTMLDivElement;
	const notifBubbleButton: HTMLButtonElement = document.getElementById("notifBubbleButton") as HTMLButtonElement;
	const notifNumberBadge: HTMLDivElement = document.getElementById("notifNumberBadge") as HTMLDivElement;

	const notifPannel: HTMLDivElement = document.getElementById("notifPannel") as HTMLDivElement;
	const notifList: HTMLUListElement = document.getElementById("notifList") as HTMLUListElement;
	const removeAllButton: HTMLButtonElement = document.getElementById("removeAllButton") as HTMLButtonElement;
	let notifNumber: number = 0;

	if (!userId || !token) {
		console.error("Not logged in");
		return;
	}

	if (!notifBubbleDiv || !notifBubbleButton || !notifNumberBadge
		|| !notifPannel || !notifList || !removeAllButton) {
		console.error("Could not get html elements");
		return;
	}

	notifBubbleButton.onclick = async () => {
		notifPannel.classList.toggle('invisible');
		notifPannel.classList.toggle('opacity-100');
		notifPannel.classList.toggle('opacity-0');
		notifBubbleDiv.classList.toggle('rotate-90');

		try {
			const res = await fetch(`${window.location.origin}/users/get-game-invits/${userId}`, {
				method: "GET",
				headers: {
					"x-user-id": userId,
					"authorization": `Bearer ${token}`,
				},
			});
			if (!res.ok) {
				console.error("Could not fetch game invitations");
				return;
			}

			const { invitList } = await res.json();
			notifList.innerHTML = "";
			const frag = document.createDocumentFragment();
			for (let invit of invitList) {

				const li: HTMLLIElement = document.createElement("li");
				li.className = "flex flex-row items-center justify-evenly w-full text-white";

				const userNameSpan: HTMLSpanElement = document.createElement("span");
				const res = await fetch(`${window.location.origin}/users/get-user/${invit.user_id}`, {
					method: "GET",
					headers: {
						"x-user-id": userId,
						"authorization": `Bearer ${token}`,
					},
				});
				if (!res.ok) {
					userNameSpan.textContent = `<undefined user>`;
				}
				const data = await res.json();
				userNameSpan.textContent = data.name;

				const acceptButton: HTMLButtonElement = document.createElement("button");
				acceptButton.textContent = "✓";
				acceptButton.onclick = async () => {
					window.location.hash = "#game";
					launchInvitGame(invit.user_id, "accept-invit");
					li.remove();
					notifNumber--;
				};

				const denyButton: HTMLButtonElement = document.createElement("button");
				denyButton.textContent = "✗";
				denyButton.onclick = async () => {
					launchInvitGame(invit.user_id, "deny-invit");
					li.remove();
					notifNumber--;
				};
				li.append(userNameSpan, acceptButton, denyButton);
				frag.appendChild(li);
				notifNumber++;
			}
			notifList.appendChild(frag)
		} catch (error) {
			console.error("Could not fetch invitList:", error);
			return;
		}
	};



	if (notifNumber == 0)
		notifNumberBadge.classList.add('hidden');
	else {
		notifNumberBadge.classList.remove('hidden');
		notifNumberBadge.textContent = String(notifNumber);
	}

	removeAllButton.onclick = () => {
		// FETCH POUR LA DB ??

		notifList.innerHTML = "";
		notifNumber = 0;
		notifNumberBadge.classList.add('hidden');
	};
}

// A SUPPRIMER (TESTS) /////////////////////////////////////////////////////////////////////////////////
(async () => {
	if (!localStorage.getItem("userTest")) {
		const addFriendsModule = await import('./addFriends.js');
		if (addFriendsModule.initTest) addFriendsModule.initTest();
		else console.log("CA MARCHE PO");
		localStorage.setItem("userTest", "true");
	}
})();
////////////////////////////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', async () => {


	handleOauth42Redirect();

	const router: Router = new Router();
	const isGuest: boolean = await router.checkGuest();

	if (!sessionStorage.getItem("jwt") || isGuest)
		document.body.classList.remove("loggedIn");
	else
		document.body.classList.add("loggedIn");
	notificationHandler();
});


const	PAGE_BACKGROUNDS: Record<string, string> = {
	'account': '/img/Background1.png',
	'editProfile': '/img/Background1.png',
	'game': '/img/Background1.png',
	'home': '/img/Background2.png',
	'login': '/img/Background1.png',
	'logout': '/img/Background1.png',
	'signup': '/img/Background1.png',
	'tournament': '/img/Background1.png',
}

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

const	PAGE_ORDER: string [] = ['home', 'game', 'tournament', 'account', 'logout', 'signup', 'login'];

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

	private startHeartbeat (): void {

		if (this.heartBeatInterval !== null) return ;

		const sendHeartbeat = async () => {
			const token = sessionStorage.getItem("jwt");
			const userId = sessionStorage.getItem("userId");
			if (!token || !userId) return ;
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
		
		const page = window.location.hash.slice(1) || 'home';
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

		if (nextBgUrl === this.currentBgUrl) return ;

		const	currentBgContainer: HTMLElement = document.getElementById('backgroundContainer') as HTMLElement;
		const	nextBgContainer: HTMLElement = document.getElementById('backgroundNext') as HTMLElement;

		if (!currentBgContainer || !nextBgContainer) {
			console.error('Could not find background containers');
			return ;
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

				const	nextBackgroundUrl: string = PAGE_BACKGROUNDS[page] || PAGE_BACKGROUNDS['home'];
				const	transitionDirection: string = this.getTransitionDirection(page);
				// await this.animateBgTransition(nextBackgroundUrl, transitionDirection);
			
				// Fetch the file corresponding to the attribute page
				// Then gets its content as a text in the variabe content
				const response = await fetch(`/pages/${page}.html`);
				if (!response.ok) throw new Error(`Page ${page} not found`);
				const content = await response.text();

				// Updates the <main> of index.html
				this.mainContent.innerHTML = content;

				// Loads the scripts corresponding the the page loaded
				switch(page) {
					case 'home':
						const homeScript = await import('./home.js'); // on peut mettre ca en haut
						if (homeScript.home) homeScript.home();
						break;
					case 'game':
						const gameScript = await import('./game.js')
						const localButton = document.getElementById('gameLocalGameButton');
						if (localButton && gameScript.launchLocalGame) {
							localButton.addEventListener('click', async () => {
								try {
									await gameScript.launchLocalGame();
								} catch (error) {
									console.error('Error launching the game:', error);
								}
							})
						}
						const remoteButton = document.getElementById('gameRemoteGameButton');
						if (remoteButton && gameScript.launchRemoteGame) {
							remoteButton.addEventListener('click', async () => {
								try {
									await gameScript.launchRemoteGame();
								} catch (error) {
									console.error('Error launching the game:', error);
								}
							})
						}
						break;
					case 'tournament':
						const tournamentScript = await import('./tournament.js');
						// if (tournamentScript.tournament) tournamentScript.tournament();
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
			this.mainContent.innerHTML = '<h1>Page not found</h1>'; // A changer ?
		}
	}
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

document.addEventListener('DOMContentLoaded', () => {

	if (!sessionStorage.getItem("jwt"))
		document.body.classList.remove("loggedIn");
	else
		document.body.classList.add("loggedIn");
	console.log(document.body.classList);

	handleOauth42Redirect();

	new Router();
});

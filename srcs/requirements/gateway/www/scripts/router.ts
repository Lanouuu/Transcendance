class Router {

	private mainContent: HTMLElement;
	private BASE_URL: string = "https://localhost:8443/auth_service";

	constructor() {
		// Selects the part of the html doc we want to update (?)
		this.mainContent = document.querySelector('main') as HTMLElement;
		// Launches the chain of function 
		this.initRouter();
	}

	private async initRouter(): Promise<void> {

		// First load (supposed to launch main i guess)
		this.handleRoute();

		// A SUPPRIMER (TESTS) /////////////////////////////////////////////////////////////////////////////////
		const addFriendsModule = await import('./addFriends.js');
		if (addFriendsModule.initTest) addFriendsModule.initTest();
		else console.log("CA MARCHE PO");
		////////////////////////////////////////////////////////////////////////////////////////////////////////

		window.addEventListener('hashchange', () => this.handleRoute());
	}

	// Gets called each time the hash (#) changes (?)
	// Get the name of the page clean and call loadPage
	private handleRoute(): void {
		
		const page = window.location.hash.slice(1) || 'home';
		this.loadPage(page);
	}

	// Fetch the correct html file to update the <main> of index.html
	// Load scripts related to the page
	private async loadPage(page: string): Promise<void> {

		try {
			
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
						const homeScript = await import('./home.js');
						if (homeScript.home) homeScript.home();
						break;
					case 'game':
						const gameScript = await import('./game.js');
						// if (gameScript.game) gameScript.game();
						break;
					case 'tournament':
						const tournamentScript = await import('./tournament.js');
						// if (tournamentScript.tournament) tournamentScript.tournament();
						break;
					case 'account':
						const accountScript = await import('./account.js');
						if (accountScript.displayAccountPage) accountScript.displayAccountPage();
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



document.addEventListener('DOMContentLoaded', () => {

	if (!localStorage.getItem("jwt"))
		document.body.classList.remove("loggedIn");
	else
		document.body.classList.add("loggedIn");
	console.log(document.body.classList);
	new Router();
});

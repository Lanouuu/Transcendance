class Router {

	private mainContent: HTMLElement;
	private BASE_URL: string = "https://localhost:8443/auth_service";

	constructor() {
		// Selects the part of the html doc we want to update (?)
		this.mainContent = document.querySelector('main') as HTMLElement;
		// Launches the chain of function 
		this.initRouter();
	}

	// Gets called each time the hash (#) changes (?)
	private initRouter(): void {

		// First load (supposed to launch main i guess)
		this.handleRoute();

		// A SUPPRIMER --> Permet de creer un user test
		const res = fetch(`${this.BASE_URL}/signup`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userName:'test', mail:'test@test.fr', password:'test', enable2FA:false})
		});
		////////////////////////////////////////////////////////////////////////////////////////////////////////

		window.addEventListener('hashchange', () => this.handleRoute());
	}

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
						await import('./home.js');
						break;
					case 'game':
						await import('./game.js');
						break;
					case 'tournament':
						await import('./tournament.js');
						break;
					case 'friends':
						await import('./friends.js');
						break;
					case 'account':
						await import('./account.js');
						break;
					case 'login':
						await import('./login.js');
						break;
					case 'signup':
						await import('./signup.js');
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
	new Router();
});

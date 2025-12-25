export function login() {

	const BASE_URL: string = `${window.location.origin}/auth_service`;

	const form:			HTMLFormElement = document.getElementById("login-form") as HTMLFormElement;
	const buttonGest:	HTMLButtonElement = document.getElementById("guestConnectionButton") as HTMLButtonElement;
	const button42:		HTMLButtonElement = document.getElementById("42ConnectionButton") as HTMLButtonElement;

	if (form) {
		form.addEventListener("submit", async (e) => {
			e.preventDefault();

			const mail: string = (document.getElementById("boxMailLogin") as HTMLInputElement).value;
			const password: string = (document.getElementById("boxPassLogin") as HTMLInputElement).value;
			const code2FA: string = (document.getElementById("box2faLogin") as HTMLInputElement).value;

			(e.target as HTMLFormElement).reset();

			try {
				const res = await fetch(`${BASE_URL}/login`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mail, password, code2FA }),
				});

				const data = await res.json();
				const msg = document.getElementById("login-msg");
				if (msg) {
					if (res.ok) {
                		msg.textContent = data.message;
                		msg.style.color = "lightgreen";
            		} else {
                		msg.textContent = data.error || data.message;
                		msg.style.color = "red";
            		}
				}

				if (res.ok && data.token && data.id) {
					sessionStorage.setItem("jwt", data.token);
					sessionStorage.setItem("userId", data.id);

					document.body.classList.add("loggedIn");

					window.dispatchEvent(new Event('user:login'));

					setTimeout(async () => {
						window.location.hash = '#account';
					}, 800);
				} else if (msg) {
					msg.textContent = data.error || "erreur de connexion.";
					msg.style.color = "red";
					return ;
				}
				
			} catch (err) {
				console.error(err);
				(document.getElementById("login-msg") as HTMLInputElement).textContent = "Communication error with server";
			}
		});
	}
	if (button42) {
		button42.addEventListener('click', async () => {
			try {
				window.location.href = `${BASE_URL}/login/42`;
			} catch (err) {
				console.error(err);
			}
		})
	}
	if (buttonGest) {
		buttonGest.addEventListener('click', async () => {

			try {
				const res = await fetch(`${window.location.origin}/users/create-guest`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}), 
				});

				// Debug: afficher ce que le serveur renvoie vraiment
    	        if (res.redirected) {
     	           console.error("Request was redirected! Check your gateway config.");
      	          return;
       	     	}

				if (res.ok) 
					console.log(res);
				const data = await res.json();
				const msg = document.getElementById("login-msg");

				if (msg && !res.ok) {
               		msg.textContent = data.error || data.message;
               		msg.style.color = "red";
					return ;
				}
				if (data.token && data.id) {
					sessionStorage.setItem("jwt", data.token);
					sessionStorage.setItem("userId", data.id);

					setTimeout(async () => {
						window.location.hash = '#game';
					}, 800);
				}
			} catch (error) {
				console.error("Failed guest connection:", error);
			}
		});
	}
}

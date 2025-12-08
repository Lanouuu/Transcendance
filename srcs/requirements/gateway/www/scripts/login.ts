export function login() {

	const BASE_URL: string = `${window.location.origin}/auth_service`;

	const form = document.getElementById("login-form");
	const button42 = document.getElementById("42ConnectionButton");

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

				if (res.ok && data.token) {
					localStorage.setItem("jwt", data.token);
					localStorage.setItem("userId", data.id);

					document.body.classList.add("loggedIn");

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
}

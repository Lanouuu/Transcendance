export function login() {

	const BASE_URL: string = "https://localhost:8443/auth_service";

	const form = document.getElementById("login-form");

	if (form) {
		form.addEventListener("submit", async (e) => {
			e.preventDefault();

			const mail: string = (document.getElementById("boxMailLogin") as HTMLInputElement).value;
			const password: string = (document.getElementById("boxPassLogin") as HTMLInputElement).value;
			const code2FA: boolean = (document.getElementById("box2faLogin") as HTMLInputElement).checked;

			try {
				const res = await fetch(`${BASE_URL}/login`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mail, password, code2FA }),
				});

				const data = await res.json();
				const msg = document.getElementById("login-msg");
				if (msg)
				{
					msg.textContent = res.ok ? "Connexion réussie !" : (data.error || "Erreur de connexion");
					msg.style.color = "lightgreen";
				}

				if (res.ok && data.token) {
					localStorage.setItem("jwt", data.token);

					setTimeout(async () => {
						const response = await fetch(`/pages/account.html`);
						if (!response.ok) throw new Error(`Page account not found`);
						const content = await response.text();
						(document.querySelector('main') as HTMLElement).innerHTML = content;
					}, 1000);
				} else if (msg) {
					msg.textContent = data.error || "erreur de connexion.";
					msg.style.color = "red";
					return ;
				}

			} catch (err) {
				console.error(err);
				(document.getElementById("login-msg") as HTMLInputElement).textContent = "Erreur de communication avec le serveur.";
			}
		});
	}
}

login();
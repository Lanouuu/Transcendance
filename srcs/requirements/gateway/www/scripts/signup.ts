export function signup() {

	const BASE_URL: string = "https://localhost:8443/auth_service";

	const form = document.getElementById("signup-form");

	if (form) {
		form.addEventListener("submit", async (e) => {
			e.preventDefault();

			const userName: string = (document.getElementById("boxUserNameSignup") as HTMLInputElement).value;
			const mail: string = (document.getElementById("boxMailSignup") as HTMLInputElement).value;
			const password: string = (document.getElementById("boxPassSignup") as HTMLInputElement).value;
			const enable2FA: boolean = (document.getElementById("box2faSignup") as HTMLInputElement).checked;

			try {
				const res = await fetch(`${BASE_URL}/signup`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userName, mail, password, enable2FA }),
				});

				const data = await res.json();
				const msg = document.getElementById("signup-msg");
				if (msg)
				{
					if (res.ok) {
                		msg.textContent = data.message;
                		msg.style.color = "lightgreen";
						setTimeout(() => {
							window.location.hash = '#login';
						}, 800);
            		} else {
                		msg.textContent = data.error || data.message;
                		msg.style.color = "red";
            		}
				}

				// Afficher le QR code si 2FA activé
				if (data.qrcodedata) {
					let img = document.querySelector("#signup-form img.qr") as HTMLImageElement;
					if (!img) {
						img = document.createElement("img");
						img.classList.add("qr");
						form.appendChild(img);
					}
					img.src = data.qrcodedata;
					img.alt = "QR Code 2FA";
				}
			} catch (err) {
					console.error(err);
					(document.getElementById("signup-msg") as HTMLInputElement).textContent = "Erreur de communication avec le serveur.";
			}
		});
	}
}

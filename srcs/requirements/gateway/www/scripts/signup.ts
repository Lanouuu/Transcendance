export function signup() {

	const BASE_URL: string = `${window.location.origin}/auth_service`;

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

				const contentType = res.headers.get("content-type");
				if (!contentType || !contentType.includes("application/json")){
					console.error(`Invalid response format: ${res.status}`);
					return ;
				}

				const data = await res.json();
				const msg = document.getElementById("signup-msg");
				if (msg)
				{
					if (res.ok) {
                		msg.textContent = data.message;
                		msg.style.color = "lightgreen";
						
						if (data.qrcodedata) {
							if (typeof data.qrcodedata === 'string' && data.qrcodedata.startsWith('data:image/png;base64,')) {
        						let img = document.querySelector("#signup-form img.qr") as HTMLImageElement;
        						if (!img) {
        						    img = document.createElement("img");
        						    img.classList.add("qr");
        						    form.appendChild(img);
        						}
        						img.src = data.qrcodedata;
        						img.alt = "QR Code 2FA";
								
								let confirmBtn = document.querySelector("#signup-form button.confirm-qr") as HTMLButtonElement;
								if (!confirmBtn) {
									confirmBtn = document.createElement("button");
									confirmBtn.classList.add("confirm-qr");
									confirmBtn.textContent = "QR code scanned";
									confirmBtn.type = "button";
									confirmBtn.className = "absolute right-80 top-1/2 translate-y-1/2 py-3 w-44 rounded-xl \
															bg-prim bg-opacity-90 hover:bg-opacity-100 \
															text-white font-semibold font-geo \
															shadow-[inset_0_4px_6px_rgba(255,255,255,0.15),_3px_3px_6px_rgba(0,0,0,0.6),_-3px_-3px_6px_rgba(255,255,255,0.1)] \
															hover:shadow-[inset_0_5px_7px_rgba(255,255,255,0.2),_4px_4px_10px_rgba(0,0,0,0.7),_-4px_-4px_10px_rgba(255,255,255,0.1)] \
															transition"
									form.appendChild(confirmBtn);
									
									confirmBtn.addEventListener("click", () => {
										window.location.hash = '#login';
									});
								}
							} else {
							    console.error('Invalid QR code data format');
							}
						} else {
							setTimeout(() => {
								window.location.hash = '#login';
							}, 800);
						}
            		} else {
                		msg.textContent = data.error || data.message;
                		msg.style.color = "red";
            		}
				}
			} catch (err) {
					console.error(err);
					(document.getElementById("signup-msg") as HTMLInputElement).textContent = "Erreur de communication avec le serveur.";
			}
		});
	}
}
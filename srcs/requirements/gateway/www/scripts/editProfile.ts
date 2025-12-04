async function updateName(BASE_URL: string, userId: string, token: string) {
    const newName: string = (document.getElementById("editUsernameInput") as HTMLInputElement).value;

    try {
        const res = await fetch(`${BASE_URL}/update-name/${userId}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
				"authorization": `Bearer ${token}`,
				"x-user-id": userId },
            body: JSON.stringify({ newName }),
        });

        const data = await res.json();
        const msg = document.getElementById("editName-msg");
        if (msg) {
            if (res.ok) {
                msg.textContent = data.message;
                msg.style.color = "lightgreen";
            } else {
                msg.textContent = data.error || data.message;
                msg.style.color = "red";
            }
        }
    } catch (err) {
        console.error(err);
		const errMsg = (document.getElementById("editName-msg") as HTMLInputElement);
        errMsg.textContent = "Erreur de communication avec le serveur";
        errMsg.style.color = "red";
    }
}

async function updateMail(BASE_URL: string, userId: string, token: string) {
    const newMail = (document.getElementById("editMailInput") as HTMLInputElement).value;
    const confirmMail = (document.getElementById("confirmMailInput") as HTMLInputElement).value;

    try {
        const res = await fetch(`${BASE_URL}/update-mail/${userId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
				"authorization": `Bearer ${token}`,
				"x-user-id": userId },
            body: JSON.stringify({ newMail, confirmMail }),
        });

        const data = await res.json();
        const msg = document.getElementById("editMail-msg");
        if (msg) {
            if (res.ok) {
                msg.textContent = data.message;
                msg.style.color = "lightgreen";
            } else {
                msg.textContent = data.error || data.message;
                msg.style.color = "red";
            }
        }
    } catch (err) {
        console.error(err);
		const errMsg = (document.getElementById("editMail-msg") as HTMLInputElement);
        errMsg.textContent = "Erreur de communication avec le serveur";
        errMsg.style.color = "red";
    }
}

async function updatePass(BASE_URL: string, userId: string, token: string) {
    const currentPassword = (document.getElementById("currentPasswordInput") as HTMLInputElement).value;
    const newPassword = (document.getElementById("editPasswordInput") as HTMLInputElement).value;
    const confirmPassword = (document.getElementById("confirmPasswordInput") as HTMLInputElement).value;

    try {
        const res = await fetch(`${BASE_URL}/update-password/${userId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
				"authorization": `Bearer ${token}`,
				"x-user-id": userId },
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });

        const data = await res.json();
        const msg = document.getElementById("editPassword-msg");
        if (msg) {
            if (res.ok) {
                msg.textContent = data.message;
                msg.style.color = "lightgreen";
            } else {
                msg.textContent = data.error || data.message;
                msg.style.color = "red";
            }
        }
    } catch (err) {
        console.error(err);
		const errMsg = (document.getElementById("editPassword-msg") as HTMLInputElement);
        errMsg.textContent = "Erreur de communication avec le serveur";
        errMsg.style.color = "red";
    }
}

export async function editProfile() {
    const BASE_URL: string = "https://localhost:8443/users";
    const userId: string = sessionStorage.getItem("userId") as string;
    const token: string = sessionStorage.getItem("jwt") as string;

    const nameForm = document.getElementById("editUsernameForm");
    const mailForm = document.getElementById("editMailForm");
    const passForm = document.getElementById("editPasswordForm");

    if (nameForm) {
        nameForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await updateName(BASE_URL, userId, token);
            (e.target as HTMLFormElement).reset();
        });
    }
    if (mailForm) {
        mailForm.addEventListener("submit", async(e) => {
            e.preventDefault();
            await updateMail(BASE_URL, userId, token);
           (e.target as HTMLFormElement).reset();
        });
    }
    if (passForm) {
        passForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await updatePass(BASE_URL, userId, token);
            (e.target as HTMLFormElement).reset();
        });
    }
}
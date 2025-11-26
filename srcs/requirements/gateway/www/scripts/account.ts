export async function displayAccountPage() {

	const BASE_URL: string = "https://localhost:8443/users";
	const userId: string | null = localStorage.getItem("userId");
	const token: string | null = localStorage.getItem("jwt");

	if (userId === null) {
		//MSG ERROR
		return;
	}

	const usernameSpan: HTMLElement | null | undefined = document.getElementById("accountBoxUsername")?.querySelector("span");
	const mailSpan: HTMLElement | null | undefined = document.getElementById("accountBoxMail")?.querySelector("span");
	const dblFaBox: HTMLInputElement | null | undefined = document.getElementById("accountBox2fa")?.querySelector("input") as HTMLInputElement;

	const profilePic: HTMLImageElement | null | undefined = document.getElementById("accountBoxProfilePic")?.querySelector("img") as HTMLImageElement;
	const profilePicInput: HTMLInputElement = document.getElementById('profilePicInput') as HTMLInputElement;
	const profilePicButton: HTMLButtonElement = document.getElementById('profilePicButton') as HTMLButtonElement;
	const profilePicButtonConfirm: HTMLButtonElement = document.getElementById('profilePicButtonConfirm') as HTMLButtonElement;
	const profilePicButtonCancel: HTMLButtonElement = document.getElementById('profilePicButtonCancel') as HTMLButtonElement;


	if (!usernameSpan || !mailSpan || !dblFaBox || !profilePic || !profilePicInput || !profilePicButton || !profilePicButtonConfirm || !profilePicButtonCancel) {
		// MSG ERROR
		console.log("Error null");
		return;
	}

	try {
		const res = await fetch(`${BASE_URL}/get-user/${userId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});

		const data = await res.json();
		if (!res.ok) throw new Error(`Page account not found`);
		usernameSpan.innerText = data.name;
		mailSpan.innerText = data.mail;
		dblFaBox.checked = data.enable2FA || false; // checkbox plutot que du text
		console.log("userData");

		const resImg = await fetch(`${BASE_URL}/get-avatar/${userId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});

		if (resImg.ok) {
			const imgBlob = await resImg.blob();
			const imgUrl = URL.createObjectURL(imgBlob);

			profilePic.src = imgUrl;
		} else {
			profilePic.src = "./img/cristal_profile_base.jpg";
			console.log("Salut");
		}

		// Ajout d'ami
		// const friendList: HTMLElement = document.getElementById("accountFriendList") as HTMLElement;
		// if (friendList) {
		// 	const res = await fetch(`${BASE_URL}/friends-list/${userId}`, {
		// 		method: "GET",
		// 		headers: {
		// 			"authorization": `Bearer ${token}`,
		// 			"x-user-id": userId
		// 		},
		// 	});
		// 	if (!res.ok) throw new Error(`Friend list not found`);
		// 	// option 1: parentheses
		// 	const data = (await res.json()).friendsList[0].name;
		// 	friendList.innerHTML = data;
		// }
		// else throw new Error("No friendList fetched");

		profilePicButton.addEventListener('click', () => {
			profilePicInput.click();
		});

// UPLOAD AVATAR

		let selectedFile: File | null = null;
		let originalSrc: string = profilePic.src;

		profilePicInput.addEventListener('change', async (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];

			if (!file) return;

			if (!file.type.startsWith('image/')) {
				alert('Please select a picture');
				return;
			}

			selectedFile = file;
			originalSrc = profilePic.src;

			const reader = new FileReader();
			reader.onload = (e) => {
				if (e.target?.result) {
					profilePic.src = e.target.result as string;
				}
			}
			reader.readAsDataURL(file);

			profilePicButton.style.display = "none";
			profilePicButtonConfirm.style.display = "block";
			profilePicButtonCancel.style.display = "block";


		})

		profilePicButtonConfirm.addEventListener('click', async () => {

			if (!selectedFile) return;

			profilePicButtonConfirm.style.display = "none";
			profilePicButtonCancel.style.display = "none";
			profilePicButton.style.display = "block";
			try {
				const formData = new FormData();
				formData.append('avatar', selectedFile);

				const res = await fetch(`${BASE_URL}/upload-avatar/${userId}`, {
					method: 'POST',
					headers: {
						"authorization": `Bearer ${token}`,
						"x-user-id": userId,
					},
					body: formData,
				});

				if (!res.ok) {
					throw new Error('Upload failed');
				}

				console.log('Avatar upload success');
			} catch (error) {
				console.error('Error uploading the avatar', error);
				// Peut etre modifier l'image de base
				profilePic.src = originalSrc;
			}
		});

		profilePicButtonCancel.addEventListener('click', async () => {

			profilePicButtonConfirm.style.display = "none";
			profilePicButtonCancel.style.display = "none";
			profilePicButton.style.display = "block";
			profilePic.src = originalSrc;
			selectedFile = null;
			profilePicInput.value = '';
		});

	} catch (error) {
		console.error(error);
		// Faire qqch pour informer 
	}

}

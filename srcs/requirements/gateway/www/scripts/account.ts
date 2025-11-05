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

	if (usernameSpan === null || usernameSpan === undefined || mailSpan === null || mailSpan === undefined ||
		dblFaBox === null || dblFaBox === undefined || profilePic === null || profilePic === undefined) {
		// MSG ERROR
		console.log("Error null");
		return;
	}

	try {
		const res = await fetch(`${BASE_URL}/get-user/${userId}`, {
			method: "GET",
			headers: { 
				"authorization": `Bearer ${token}`,
				"x-user-id": userId },
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
				"x-user-id": userId },
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
		const friendList :HTMLElement= document.getElementById("accountFriendList") as HTMLElement;
		if (friendList){
			const res = await fetch(`${BASE_URL}/friends-list/${userId}`, {
				method: "GET",
				headers: {
					"authorization": `Bearer ${token}`,
					"x-user-id": userId },
			});
			if (!res.ok) throw new Error(`Friend list not found`);
			// option 1: parentheses
			const data = (await res.json()).friendsList[0].name;
			friendList.innerHTML = data;
		}
		else throw new Error("No friendList fetched");
	} catch (error) {
		console.error(error);
		// Faire qqch pour informer 
	}

}

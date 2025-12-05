const USERS_URL: string = "https://localhost:8443/users";

export async function displayAccountPage() {

	const	userId:				string | null = localStorage.getItem("userId");
	const	token:				string | null = localStorage.getItem("jwt");
	let		accountActiveTab:	string | null = localStorage.getItem("accountActiveTab");

	if (!userId || !token) {
		console.error("Userid or token NULL");
		return;
	}

	const tabTable: { [key: string]: {div: HTMLDivElement, btn: HTMLButtonElement, tab: HTMLLIElement, fctn: () => Promise<void> }} = {
		'infos': {
			'div': document.getElementById("infosTab") as HTMLDivElement,
			'btn': document.getElementById("infosTabButton") as HTMLButtonElement,
			'tab': document.getElementById("infosTabLi") as HTMLLIElement,
			'fctn': () => showInfosTab(userId, token)
		},
		'friends': {
			'div': document.getElementById("friendsTab") as HTMLDivElement,
			'btn': document.getElementById("friendsTabButton") as HTMLButtonElement,
			'tab': document.getElementById("friendsTabLi") as HTMLLIElement,
			'fctn': () => showFriendsTab()
		},
		'stats': {
			'div': document.getElementById("statsTab") as HTMLDivElement,
			'btn': document.getElementById("statsTabButton") as HTMLButtonElement,
			'tab': document.getElementById("statsTabLi") as HTMLLIElement,
			'fctn': () => showStatsTab()
		},
		'history': {
			'div': document.getElementById("historyTab") as HTMLDivElement,
			'btn': document.getElementById("historyTabButton") as HTMLButtonElement,
			'tab': document.getElementById("historyTabLi") as HTMLLIElement,
			'fctn': () => showHistoryTab()
		}
	}

	if (	!tabTable.infos.div || !tabTable.infos.btn || !tabTable.infos.tab
		||	!tabTable.friends.div || !tabTable.friends.btn || !tabTable.friends.tab
		||	!tabTable.stats.div || !tabTable.stats.btn || !tabTable.stats.tab
		||	!tabTable.history.div || !tabTable.history.btn || !tabTable.history.tab) 
	{
		console.error("HTML element not found: tab display / div / button");
		return;
	} 

	try {
		
		Object.keys(tabTable).forEach(tabKey => {

			tabTable[tabKey].btn.addEventListener('click', () => {

				Object.keys(tabTable).forEach(key => {

					tabTable[key].div.classList.toggle('hidden', key !== tabKey);
					tabTable[key].tab.classList.toggle('active', key === tabKey);
				});

				tabTable[tabKey].fctn();
				localStorage.setItem("accountActiveTab", tabKey);

			});
		});

	}catch (error) {
		console.error(error);
	}

	if (!accountActiveTab || !tabTable[accountActiveTab]) {
		accountActiveTab = 'infos';
		localStorage.setItem('accountActiveTab', 'infos')
	}
	Object.keys(tabTable).forEach(key => {
		tabTable[key].div.classList.toggle('hidden', key !== accountActiveTab);
		tabTable[key].tab.classList.toggle('active', key === accountActiveTab);
	});
	tabTable[accountActiveTab].fctn();
}

async function showInfosTab(userId: string, token: string): Promise<void> {

	const usernameSpan: HTMLElement | null | undefined = document.getElementById("accountBoxUsername")?.querySelector("span");
	const mailSpan: HTMLElement | null | undefined = document.getElementById("accountBoxMail")?.querySelector("span");
	const dblFaBox: HTMLInputElement | null | undefined = document.getElementById("accountBox2fa")?.querySelector("input") as HTMLInputElement;

	const profilePic: HTMLImageElement | null | undefined = document.getElementById("accountBoxProfilePic")?.querySelector("img") as HTMLImageElement;
	const profilePicInput: HTMLInputElement = document.getElementById('profilePicInput') as HTMLInputElement;
	const profilePicButton: HTMLButtonElement = document.getElementById('profilePicButton') as HTMLButtonElement;
	const profilePicButtonConfirm: HTMLButtonElement = document.getElementById('profilePicButtonConfirm') as HTMLButtonElement;
	const profilePicButtonCancel: HTMLButtonElement = document.getElementById('profilePicButtonCancel') as HTMLButtonElement;


	if (!usernameSpan || !mailSpan || !dblFaBox || !profilePic || !profilePicInput || !profilePicButton || !profilePicButtonConfirm || !profilePicButtonCancel) {
		console.error("HTML element not found");
		return;
	}

	try {

		// #region display //

		const res = await fetch(`${USERS_URL}/get-user/${userId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});

		const data = await res.json();
		if (!res.ok) throw new Error(`Fetch user infos failed`);
		usernameSpan.innerText = data.name;
		mailSpan.innerText = data.mail;
		dblFaBox.checked = data.enable2FA || false; // checkbox plutot que du text

		const resImg = await fetch(`${USERS_URL}/get-avatar/${userId}`, {
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
			console.error("Fetch user profile picture failed");
		}

		// #endregion display //

		// #region updateAvatar

		profilePicButton.addEventListener('click', () => {
			profilePicInput.click();
		});

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

				const res = await fetch(`${USERS_URL}/upload-avatar/${userId}`, {
					method: 'POST',
					headers: {
						"authorization": `Bearer ${token}`,
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
		// #endregion updateAvatar

	} catch (error) {
		console.error(error);
		// Faire qqch pour informer 
	}

}

async function showFriendsTab(): Promise<void> {
	console.log('showFriendsTab function called');
	
}
  
async function showStatsTab(): Promise<void> {
	console.log('showStatsTab function called');
}


async function showHistoryTab(): Promise<void> {
	console.log('showHistoryTab function called');
	
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
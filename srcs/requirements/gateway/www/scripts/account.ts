const USERS_URL: string = `${window.location.origin}/users`;

export async function displayAccountPage() {

	const userId: string | null = sessionStorage.getItem("userId");
	const token: string | null = sessionStorage.getItem("jwt");
	let		accountActiveTab:	string | null = sessionStorage.getItem("accountActiveTab");

	if (!userId || !token) {
		console.error("Userid or token NULL");
		return;
	}

	const tabTable: { [key: string]: { div: HTMLDivElement, btn: HTMLButtonElement, tab: HTMLLIElement, fctn: () => Promise<void> } } = {
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
			'fctn': () => showFriendsTab(userId, token)
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

	if (!tabTable.infos.div || !tabTable.infos.btn || !tabTable.infos.tab
		|| !tabTable.friends.div || !tabTable.friends.btn || !tabTable.friends.tab
		|| !tabTable.stats.div || !tabTable.stats.btn || !tabTable.stats.tab
		|| !tabTable.history.div || !tabTable.history.btn || !tabTable.history.tab) {
		console.error("HTML element not found: tab display / div / button");
		return;
	}

	await tabTable['infos'].fctn();
	await tabTable['friends'].fctn();
	await tabTable['stats'].fctn();
	await tabTable['history'].fctn();

	try {

		Object.keys(tabTable).forEach(tabKey => {

			tabTable[tabKey].btn.addEventListener('click', () => {

				Object.keys(tabTable).forEach(key => {

					tabTable[key].div.classList.toggle('hidden', key !== tabKey);
					tabTable[key].tab.classList.toggle('active', key === tabKey);
				});

				sessionStorage.setItem("accountActiveTab", tabKey);
			});
		});

	} catch (error) {
		console.error(error);
	}

	if (!accountActiveTab || !tabTable[accountActiveTab]) {
		accountActiveTab = 'infos';
		sessionStorage.setItem('accountActiveTab', 'infos')
	}
	Object.keys(tabTable).forEach(key => {
		tabTable[key].div.classList.toggle('hidden', key !== accountActiveTab);
		tabTable[key].tab.classList.toggle('active', key === accountActiveTab);
	});
	// tabTable[accountActiveTab].fctn();
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

			profilePicButton.classList.add('hidden');
			profilePicButtonConfirm.classList.remove('hidden');
			profilePicButtonCancel.classList.remove('hidden');


		})

		profilePicButtonConfirm.addEventListener('click', async () => {

			if (!selectedFile) return;

			profilePicButtonConfirm.classList.add('hidden');
			profilePicButtonCancel.classList.add('hidden');
			profilePicButton.classList.remove('hidden');
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

			profilePicButtonConfirm.classList.add('hidden');
			profilePicButtonCancel.classList.add('hidden');
			profilePicButton.classList.remove('hidden');
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

// #region FriendsTab //
async function showFriendsTab(userId: string, token: string): Promise<void> {
	const ulFriendsList: HTMLUListElement = document.getElementById("friendsList") as HTMLUListElement;
	const ulPendingList: HTMLUListElement = document.getElementById("inviteList") as HTMLUListElement;

	if (!ulFriendsList || !ulPendingList) {
		console.error("HTML Element not found");
		return;
	}

	// #region friendList //

	try {
		const res = await fetch(`${USERS_URL}/friends-list/${userId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (!res.ok) throw new Error(`Friend list not found`);
		const { friendsList } = (await res.json());

		ulFriendsList.innerHTML = "";
		const frag = document.createDocumentFragment();
		for (const friend of friendsList) {
			const friendId: string = friend.id;
			const friendName: string = friend.name;
			let isOnline: boolean = false;
			let avatarUrl = "./img/cristal_profile_base.jpg";

			try {
				const [resStatus, resAvatar] = await Promise.all([
					fetch(`${USERS_URL}/is-online/${friendId}`, {
						method: "GET",
						headers: { "authorization": `Bearer ${token}` },
					}),
					fetch(`${USERS_URL}/get-avatar/${friendId}`, {
						method: "GET",
						headers: { "authorization": `Bearer ${token}` },
					})
				]);

				if (resStatus && resStatus.ok) {
					isOnline = (await resStatus.json()).online;
				}

				if (resAvatar && resAvatar.ok) {
					const imgBlob = await resAvatar.blob();
					avatarUrl = URL.createObjectURL(imgBlob);
				}

			} catch (err) {
				console.error("Friend data fetch failed for", friendId, err);
			}

			frag.appendChild(createLiFriendItem(avatarUrl,friendId, friendName, isOnline, userId, token));
		}
		ulFriendsList.appendChild(frag);
	} catch (error) {
		console.error("Error displaying friends Tab:", error); // afficher msg dans une div pour le user
	}
	// #endregion friendList //

	// #region inviteList //

	try {
		const res = await fetch(`${USERS_URL}/get-invits/${userId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (!res.ok) throw new Error(`Invite list not found`);
		const { pendingList } = (await res.json());

		ulPendingList.innerHTML = "";
		const frag = document.createDocumentFragment();
		for (const invite of pendingList) {
			const senderId: string = invite.sender_id;
			const senderName: string = invite.sender_name;
			frag.appendChild(createLiPendingItem(userId, token, senderId, senderName))
		}
		ulPendingList.appendChild(frag);
	} catch (error) {
		console.error("Pending data fetch failed", error);
	}
	
	// #endregion inviteList //

	// #region sendInvit

	const invitForm = document.getElementById("inviteUserForm");

	if (invitForm) {
        invitForm.addEventListener("submit", async (e) => {
            e.preventDefault();
			
			const friendName: string = (document.getElementById("inviteUserInput") as HTMLInputElement).value;

			try {
				const res = await fetch(`${USERS_URL}/send-invit`, {
					method: "POST",
           			headers: {
						"x-user-id": userId,
                		"Content-Type": "application/json",
						"authorization": `Bearer ${token}`
            		},
            		body: JSON.stringify({ friendName }),
				})
				
				const data = await res.json();
        		const msg = document.getElementById("sendInvit-msg");
        		if (msg) {
            		if (res.ok) {
                		msg.textContent = data.message;
                		msg.style.color = "lightgreen";
            		} else {
                		msg.textContent = data.error || data.message;
                		msg.style.color = "red";
            		}
				}

				await showFriendsTab(userId, token);
			} catch (err) {
				console.error(err);
				//ajouter message
			}
            (e.target as HTMLFormElement).reset();
        });
    }

	// #endregion inviteList //
}

function createLiFriendItem(avatarUrl: string, friendId: string, friendName: string, isOnline: boolean, userId: string, token: string): HTMLLIElement {
	// creation balise li
	const li = document.createElement("li");
	li.style.display = "grid";
	li.style.gridTemplateColumns = "1fr 1fr 5fr 1fr 1fr 1fr";
	li.className = "m-1";


	// ajout de l'image
	const img = document.createElement("img");
	img.src = avatarUrl;
	img.width = 36;
	img.height = 36;
	img.className = "rounded-full";

	//ajout du username
	const nameSpan = document.createElement("span");
	nameSpan.textContent = friendName;
	nameSpan.className = "text-center";

	// Ajout du status de connexion
	const statusDot = document.createElement("span");
	statusDot.textContent = isOnline ? "🟢" : "⚪️";

	// Ajout du bouton de defi
	const playButton = document.createElement("button");
	const playIcon = document.createElement("img");

	// playButton.id = "fInListPlayButton"; // Si plusieurs amis id identiques
	playIcon.src = "./assets/other/challenge-user.svg";
	playIcon.width = 24;
	playIcon.height = 24;
	playIcon.className = "invert"
	playButton.appendChild(playIcon);

	// Ajout du bouton de suppression d'un ami
	const delFriendButton = document.createElement("button");
	const delFriendIcon = document.createElement("img");

	// delFriendButton.id = "fInListDelFriendButton"; // Same
	delFriendIcon.src = "./assets/other/delete-user.svg";
	delFriendIcon.width = 24;
	delFriendIcon.height = 24;
	delFriendIcon.className = "invert"
	delFriendButton.appendChild(delFriendIcon);
	delFriendButton.onclick = async () => {
		try {
			if (!confirm(`Delete ${friendName} from your friend's list ?`)) return ;
			const res = await fetch(`${USERS_URL}/delete-friend`, {
				method: "POST",
				headers: {
					"x-user-id": userId,
					"authorization": `Bearer ${token}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({friendID: friendId})
			});
			if (!res.ok) {
				console.error("Could not delete friend");
				return ;
			}
			li.remove();
			console.log("Friend deleted");
			// Ajouter une confirmation + un msg d'info
		} catch (error) {
			console.error("Could not delete friend");
			return ;
		}
	}

	// Ajout du bouton de blocage d'un ami
	const blockFriendButton = document.createElement("button");
	const blockFriendIcon = document.createElement("img");
	
	// blockFriendButton.id = "fInListBlockFriendButton"; // Same
	blockFriendIcon.src = "./assets/other/block-user.svg";
	blockFriendIcon.width = 24;
	blockFriendIcon.height = 24;
	blockFriendIcon.className = "invert"
	blockFriendButton.appendChild(blockFriendIcon);
	blockFriendButton.onclick = async () => {
		try {
			if (!confirm(`Block ${friendName} ?`)) return ;
			const res = await fetch(`${USERS_URL}/block-friend`, {
				method: "POST",
				headers: {
					"x-user-id": userId,
					"authorization": `Bearer ${token}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({friendID: friendId})
			});
			if (!res.ok) {
				console.error("Could not block friend");
				return ;
			}
			li.remove();
			console.log("Friend blocked");
			// Ajouter une confirmation + un msg d'info
		} catch (error) {
			console.error("Could not block friend");
			return ;
		}
	};

	// Ajout de tous les elements crees a la balise li
	li.append(img, statusDot, nameSpan, playButton, delFriendButton, blockFriendButton);

	return (li);
}

function createLiPendingItem(userId: string, token: string, senderId: string, senderName: string): HTMLLIElement {

	const li = document.createElement("li");

	const nameSpan = document.createElement("span");
	nameSpan.textContent = senderName;
	nameSpan.className = "text-center";

	// Ajout du bouton accept invitation
	const acceptFriendButton = document.createElement("button");
	const acceptFriendIcon = document.createElement("img");
	
	// acceptFriendButton.id = "fInListacceptFriendButton"; // Same
	acceptFriendIcon.src = "./assets/other/add-user.svg";
	acceptFriendIcon.width = 24;
	acceptFriendIcon.height = 24;
	acceptFriendIcon.className = "invert"
	acceptFriendButton.appendChild(acceptFriendIcon);
	acceptFriendButton.onclick = async () => {
		try {
			const res = await fetch(`${USERS_URL}/accept-invit`, {
				method: "POST",
				headers: {
					"x-user-id": userId,
					"authorization": `Bearer ${token}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({friendID: senderId})
			});
			if (!res.ok) {
				console.error("Could not accept invitation");
				return ;
			}
			li.remove();
			await showFriendsTab(userId, token);
			console.log("Invitation accepted");
		} catch (error) {
			console.error("Could not accept invitation");
			return ;
		}
	};

	// Ajout du bouton decline invitation
	const declineFriendButton = document.createElement("button");
	const declineFriendIcon = document.createElement("img");
	
	// acceptFriendButton.id = "fInListacceptFriendButton"; // Same
	declineFriendIcon.src = "./assets/other/delete-user.svg";
	declineFriendIcon.width = 24;
	declineFriendIcon.height = 24;
	declineFriendIcon.className = "invert"
	declineFriendButton.appendChild(declineFriendIcon);
	declineFriendButton.onclick = async () => {
		try {
			const res = await fetch(`${USERS_URL}/decline-invit`, {
				method: "POST",
				headers: {
					"x-user-id": userId,
					"authorization": `Bearer ${token}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({friendID: senderId})
			});
			if (!res.ok) {
				console.error("Could decline invitation");
				return ;
			}
			li.remove();
			console.log("Invitation declined");
		} catch (error) {
			console.error("Could not decline invitation");
			return ;
		}
	};

	// Ajout du bouton de blocage d'un ami
	const blockFriendButton = document.createElement("button");
	const blockFriendIcon = document.createElement("img");
	
	// blockFriendButton.id = "fInListBlockFriendButton"; // Same
	blockFriendIcon.src = "./assets/other/block-user.svg";
	blockFriendIcon.width = 24;
	blockFriendIcon.height = 24;
	blockFriendIcon.className = "invert"
	blockFriendButton.appendChild(blockFriendIcon);
	blockFriendButton.onclick = async () => {
		try {
			if (!confirm(`Block ${senderName} ?`)) return ;
			const res = await fetch(`${USERS_URL}/block-friend`, {
				method: "POST",
				headers: {
					"x-user-id": userId,
					"authorization": `Bearer ${token}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({friendID: senderId})
			});
			if (!res.ok) {
				console.error("Could not block friend");
				return ;
			}
			li.remove();
			console.log("Friend blocked");
			// Ajouter une confirmation + un msg d'info
		} catch (error) {
			console.error("Could not block friend");
			return ;
		}
	};

	

	li.append(nameSpan, acceptFriendButton, declineFriendButton, blockFriendButton);
	return (li);
}

// #endregion FriendsTab //

async function showStatsTab(): Promise<void> {
	console.log('showStatsTab function called');
}


async function showHistoryTab(): Promise<void> {
	console.log('showHistoryTab function called');

}

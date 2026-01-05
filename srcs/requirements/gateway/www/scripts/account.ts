const USERS_URL: string = `${window.location.origin}/users`;

export async function displayAccountPage() {

	const	userId: string | null = sessionStorage.getItem("userId");
	const	token: string | null = sessionStorage.getItem("jwt");
	let		accountActiveTab:	string | null = sessionStorage.getItem("accountActiveTab");

	if (!userId || !token) {
		console.error("Userid or token NULL");
		window.location.hash = '#home';
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
			'fctn': () => showHistoryTab(userId, token)
		}
	};

	if (!tabTable.infos.div || !tabTable.infos.btn || !tabTable.infos.tab
		|| !tabTable.friends.div || !tabTable.friends.btn || !tabTable.friends.tab
		|| !tabTable.stats.div || !tabTable.stats.btn || !tabTable.stats.tab
		|| !tabTable.history.div || !tabTable.history.btn || !tabTable.history.tab) {
		console.error("HTML element not found: tab display / div / button");
		return;
	}
	if (!accountActiveTab || !tabTable[accountActiveTab]) {
    	sessionStorage.setItem('accountActiveTab', 'infos');
		accountActiveTab = 'infos';
		await tabTable['infos'].fctn();
	}
	else {
		if (accountActiveTab) await tabTable[accountActiveTab].fctn();
	}

	try {

		Object.keys(tabTable).forEach(tabKey => {

			tabTable[tabKey].btn.addEventListener('click', () => {

				Object.keys(tabTable).forEach(key => {

					tabTable[key].div.classList.toggle('hidden', key !== tabKey);
					tabTable[key].tab.classList.toggle('active', key === tabKey);
				});
				tabTable[tabKey].fctn();
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
}

async function showInfosTab(userId: string, token: string): Promise<void> {

	const usernameSpan: HTMLElement | null | undefined = document.getElementById("accountBoxUsername")?.querySelector("span");
	const mailSpan: HTMLElement | null | undefined = document.getElementById("accountBoxMail")?.querySelector("span");
	const dblFaBox: HTMLInputElement | null | undefined = document.getElementById("accountBox2fa")?.querySelector("input") as HTMLInputElement;
	const userInfoMsg: HTMLDivElement = document.getElementById("userInfosMsg") as HTMLDivElement;

	const profilePic: HTMLImageElement | null | undefined = document.getElementById("accountBoxProfilePic")?.querySelector("img") as HTMLImageElement;
	const profilePicInput: HTMLInputElement = document.getElementById('profilePicInput') as HTMLInputElement;
	const profilePicButton: HTMLButtonElement = document.getElementById('profilePicButton') as HTMLButtonElement;
	const profilePicButtonConfirm: HTMLButtonElement = document.getElementById('profilePicButtonConfirm') as HTMLButtonElement;
	const profilePicButtonCancel: HTMLButtonElement = document.getElementById('profilePicButtonCancel') as HTMLButtonElement;
	const userPicMsg: HTMLDivElement = document.getElementById("userPicMsg") as HTMLDivElement;

	const pongWinrateDiv: HTMLDivElement = document.getElementById("accountInfosPongWinrate") as HTMLDivElement;
	const snakeWinrateDiv: HTMLDivElement = document.getElementById("accountInfosSnakeWinrate") as HTMLDivElement;


	if (!usernameSpan || !mailSpan || !dblFaBox
		|| !profilePic || !profilePicInput || !profilePicButton
		|| !profilePicButtonConfirm || !profilePicButtonCancel
		|| !pongWinrateDiv || !snakeWinrateDiv) {
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
		if (userInfoMsg) {
			userInfoMsg.classList.toggle('opacity-0');
			userInfoMsg.classList.toggle('opacity-100');
			if (!res.ok){
				userInfoMsg.textContent = data.error;
				userInfoMsg.style.color = 'red';
			} 
			setTimeout(async () => {
				userInfoMsg.classList.toggle('opacity-100');
				userInfoMsg.classList.toggle('opacity-0');
			}, 2000);
		}
		usernameSpan.innerText = data.name;
		mailSpan.innerText = data.mail;
		dblFaBox.checked = data.enable2FA || false;

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
			if (userPicMsg) {
				userPicMsg.classList.toggle('opacity-0');
				userPicMsg.classList.toggle('opacity-100');
				userPicMsg.textContent = "Failed loading profile picture";
				userPicMsg.style.color = 'red';
				setTimeout(async () => {
					userPicMsg.classList.toggle('opacity-100');
					userPicMsg.classList.toggle('opacity-0');
				}, 2000);
			}
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

				if (userPicMsg) {
					userPicMsg.classList.toggle('opacity-0');
					userPicMsg.classList.toggle('opacity-100');
					if (res.ok) {
						userPicMsg.textContent = "Upload success";
						userPicMsg.style.color = "green";
					}
					else {
						userPicMsg.textContent = "Upload failure";
						userPicMsg.style.color = "red";
					}
					setTimeout(async () => {
						userPicMsg.classList.toggle('opacity-100');
						userPicMsg.classList.toggle('opacity-0');
					}, 2000);
				}
				if (!res.ok) {
					profilePic.src = originalSrc;
					return ;
				}
				console.log('Avatar upload success');
			} catch (error) {
				console.error('Error uploading the avatar', error);
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

		// #region stats //

		const pongWins = Number(data.pong_wins) || 0;
		const pongLosses = Number(data.pong_losses) || 0;
		const totalPongMatches = pongWins + pongLosses;
		const pongWinrate = totalPongMatches === 0 ? 0 : Math.round((pongWins / totalPongMatches) * 100);
		pongWinrateDiv.textContent = `${pongWinrate}%`;

		const snakeWins = Number(data.snake_wins) || 0;
		const snakeLosses = Number(data.snake_losses) || 0;
		const totalSnakeMatches = snakeWins + snakeLosses;
		const snakeWinrate = totalSnakeMatches === 0 ? 0 : Math.round((snakeWins / totalSnakeMatches) * 100);
		snakeWinrateDiv.textContent = `${snakeWinrate}%`;
		// #endregion stats //
	} catch (error) {
		console.error(error);
	}

}

// #region FriendsTab //

async function showFriendsTab(userId: string, token: string): Promise<void> {
	
	const ulFriendsList: HTMLUListElement = document.getElementById("friendsList") as HTMLUListElement;
	const ulPendingList: HTMLUListElement = document.getElementById("inviteList") as HTMLUListElement;
	const invitForm: HTMLFormElement = document.getElementById("inviteUserForm") as HTMLFormElement;
	const ulBlockedList: HTMLUListElement = document.getElementById("blockedList") as HTMLUListElement;

	if (!ulFriendsList || !ulPendingList || !invitForm || !ulBlockedList) {
		console.error("HTML Element not found");
		return;
	}

	await displayFriendList(userId, token, ulFriendsList, ulBlockedList);
	await displayPendingList(userId, token, ulPendingList, ulFriendsList, ulBlockedList);
	await listenSendInvite(userId, token, invitForm, ulFriendsList, ulPendingList, ulBlockedList);
	await displayBlockedList(userId, token, ulBlockedList);
}

async function displayFriendList(userId: string, token: string, ulFriendsList: HTMLUListElement, ulBlockedList: HTMLUListElement): Promise<void> {
	
	const friendListMsg: HTMLDivElement = document.getElementById("friendListMsg") as HTMLDivElement;

	try {
		const res = await fetch(`${USERS_URL}/friends-list/${userId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (friendListMsg) {
			friendListMsg.classList.toggle('opacity-0');
			friendListMsg.classList.toggle('opacity-100');
			if (!res.ok) {
				friendListMsg.textContent = "Loading Failure";
				friendListMsg.style.color = "red";
			}
			setTimeout(async () => {
				friendListMsg.classList.toggle('opacity-0');
				friendListMsg.classList.toggle('opacity-100');
			}, 2000);
		}
		if (!res.ok) {
			console.error("Could not fetch friendList");
			return ;
		}

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

			frag.appendChild(createLiFriendItem(avatarUrl,friendId, friendName, isOnline, userId, token, ulBlockedList));
		}
		ulFriendsList.appendChild(frag);
	} catch (error) {
		console.error("Error displaying friends list:", error);
	}
}

async function displayPendingList(userId: string, token: string, ulPendingList: HTMLUListElement, ulFriendsList: HTMLUListElement, ulBlockedList: HTMLUListElement): Promise<void> {

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
			frag.appendChild(createLiPendingItem(userId, token, senderId, senderName, ulFriendsList, ulBlockedList))
		}
		ulPendingList.appendChild(frag);
	} catch (error) {
		console.error("Error displaying pending list", error);
	}
}

async function listenSendInvite(userId: string, token: string, invitForm: HTMLFormElement, ulFriendsList: HTMLUListElement, ulPendingList: HTMLUListElement, ulBlockedList: HTMLUListElement): Promise<void> {

	if (invitForm && invitForm.dataset.bound !== "1") {
		invitForm.dataset.bound = "1";
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

				if (res.ok) {
					await displayFriendList(userId, token, ulFriendsList, ulBlockedList);
					await displayPendingList(userId, token, ulPendingList, ulFriendsList, ulBlockedList);
				}
			} catch (err) {
				console.error(err);
				//ajouter message
			}
            (e.target as HTMLFormElement).reset();
        });
    }
}

async function displayBlockedList(userId: string, token: string, ulBlockedList: HTMLUListElement) {
	
	try {
		const res = await fetch(`${USERS_URL}/blocked-users/${userId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (!res.ok) throw new Error(`Blocked list not found`);
		const { blockedUsers } = (await res.json());

		ulBlockedList.innerHTML = "";
		const frag = document.createDocumentFragment();
		for (const blocked of blockedUsers) {
			const blockedId: string = blocked.id;
			const blockedName: string = blocked.name;

			frag.appendChild(createLiBlockedItem(blockedId, blockedName, userId, token));
		}
		ulBlockedList.appendChild(frag);
	} catch (error) {
		console.error("Error displaying blocked list:", error); // afficher msg dans une div pour le user
	}
}

function createLiFriendItem(avatarUrl: string, friendId: string, friendName: string, isOnline: boolean, userId: string, token: string, ulBlockedList: HTMLUListElement): HTMLLIElement {
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
	img.className = "rounded-full select-none";

	//ajout du username
	const nameSpan = document.createElement("span");
	nameSpan.textContent = friendName;
	nameSpan.className = "text-center";

	// Ajout du status de connexion
	const statusDot = document.createElement("span");
	statusDot.textContent = isOnline ? "🟢" : "⚪️";
	statusDot.className = "select-none";

	// Ajout du bouton de defi
	const playPongButton = document.createElement("button");
	const playPongIcon = document.createElement("img");

	// playButton.id = "fInListPlayButton"; // Si plusieurs amis id identiques
	playPongIcon.src = "./assets/other/challenge-user.svg";
	playPongIcon.className = "h-6 w-6 invert";
	playPongButton.className = "w-fit h-fit place-self-center";
	playPongButton.onclick = async () => {
		const onlineRes = await fetch (`${window.location.origin}/users/is-online/${friendId}`, {
			method: "GET",
			headers: {
				"x-user-id": userId,
				"authorization": `Bearer ${token}`,
			}
		});
		const onlineData = await onlineRes.json();
		if (!onlineRes.ok) {
			console.error(onlineData.error);
			return ;
		}
		else if (!onlineData.online) {
			const errorMsg: HTMLDivElement = document.getElementById("friendListMsg") as HTMLDivElement;
			if (errorMsg) {
				errorMsg.classList.toggle('opacity-0');
				errorMsg.classList.toggle('opacity-100');
				errorMsg.textContent = "Cannot invite an offline user";
				errorMsg.style.color = 'red';
				setTimeout(() => {
					errorMsg.classList.toggle('opacity-100');
					errorMsg.classList.toggle('opacity-0');
				}, 2000);
			}
			return ;
		}
		const inviteRes = await fetch(`${window.location.origin}/users/invit-game/${friendId}`, {
			method: "POST",
			headers: {
				"x-user-id": userId,
				"authorization": `Bearer ${token}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({gameType: "pong", message: "invit"})
		}); 
		if (!inviteRes.ok) {
			const data = await inviteRes.json();
			const errorMsg: HTMLDivElement = document.getElementById("friendListMsg") as HTMLDivElement;
			if (errorMsg) {
				errorMsg.textContent = data.error;
				errorMsg.style.color = 'red';
			}
			return ;
		}
		window.location.hash = "#game?invite=" + friendId + "&message=sendInvit";
	}
	playPongButton.appendChild(playPongIcon);

	const delFriendButton = document.createElement("button");
	const delFriendIcon = document.createElement("img");

	delFriendIcon.src = "./assets/other/delete-user.svg";
	delFriendIcon.className = "h-6 w-6 invert"
	delFriendButton.className = "w-fit h-fit place-self-center";
	delFriendButton.appendChild(delFriendIcon);
	delFriendButton.onclick = async () => {
		try {
			if (!confirm(`Delete this from your friend's list ?`)) return ;
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
	
	blockFriendIcon.src = "./assets/other/block-user.svg";
	blockFriendIcon.className = "w-6 h-6 invert"
	blockFriendButton.className = "w-fit h-fit place-self-center";
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
			await displayBlockedList(userId, token, ulBlockedList)
			// Ajouter une confirmation + un msg d'info
		} catch (error) {
			console.error("Could not block friend");
			return ;
		}
	};

	// Ajout de tous les elements crees a la balise li
	li.append(img, statusDot, nameSpan, playPongButton, delFriendButton, blockFriendButton);

	return (li);
}

function createLiPendingItem(userId: string, token: string, senderId: string, senderName: string, ulFriendsList: HTMLUListElement, ulBlockedList: HTMLUListElement): HTMLLIElement {

	const li = document.createElement("li");
	li.className = 'flex items-center justify-between gap-2 w-5/6';

	const nameSpan = document.createElement("span");
	nameSpan.textContent = senderName;
	nameSpan.className = "text-center w-1/2 truncate";

	// Ajout du bouton accept invitation
	const acceptFriendButton = document.createElement("button");
	const acceptFriendIcon = document.createElement("img");
	
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
			await displayFriendList(userId, token, ulFriendsList, ulBlockedList);
			console.log("Invitation accepted");
		} catch (error) {
			console.error("Could not accept invitation");
			return ;
		}
	};

	// Ajout du bouton decline invitation
	const declineFriendButton = document.createElement("button");
	const declineFriendIcon = document.createElement("img");
	
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
	
	blockFriendIcon.src = "./assets/other/block-user.svg";
	blockFriendIcon.width = 24;
	blockFriendIcon.height = 24;
	blockFriendIcon.className = "invert"
	blockFriendButton.appendChild(blockFriendIcon);
	blockFriendButton.onclick = async () => {
		try {
			if (!confirm(`Block this friend ?`)) return ;
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
			await displayFriendList(userId, token, ulFriendsList, ulBlockedList);
			await displayBlockedList(userId, token, ulBlockedList);
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

function createLiBlockedItem(blockedId: string, blockedName: string, userId: string, token: string): HTMLLIElement {
	const li = document.createElement("li");
	li.className = 'flex flex-rows items-center justify-between w-5/6';

	const nameDiv = document.createElement("div");
	nameDiv.textContent = blockedName;
	nameDiv.className = "text-center";

	const unblockFriendButton = document.createElement("button");
	const unblockFriendIcon = document.createElement("img");
	
	unblockFriendIcon.src = "./assets/other/unblock-user.svg";
	unblockFriendIcon.width = 24;
	unblockFriendIcon.height = 24;
	unblockFriendIcon.className = "invert"
	unblockFriendButton.appendChild(unblockFriendIcon);
	unblockFriendButton.onclick = async () => {
		try {
			if (!confirm(`Unblock this user ?`)) return ;
			const res = await fetch(`${USERS_URL}/unblock-user`, {
				method: "POST",
				headers: {
					"x-user-id": userId,
					"authorization": `Bearer ${token}`,	
					"Content-Type": "application/json"
				},
				body: JSON.stringify({friendID: blockedId})
			});
			if (!res.ok) {
				console.error("Could not unblock friend");
				return ;
			}
			li.remove();
			console.log("Friend unblocked");
			// Ajouter une confirmation + un msg d'info
		} catch (error) {
			console.error("Could not unblock friend");
			return ;
		}
	};
	li.append(nameDiv, unblockFriendButton);
	return (li);
}
// #endregion FriendsTab //

async function showStatsTab(): Promise<void> {
	console.log('showStatsTab function called');
}

async function showHistoryTab(userId: string, token: string): Promise<void> {

	const ulHistoryList: HTMLUListElement = document.getElementById("gameHistoryList") as HTMLUListElement;

	if (!ulHistoryList) {
		console.error("Could not get HTML Element");
		return ;
	}

	try {
		const res = await fetch(`${USERS_URL}/get-matches/${userId}`, {
			method: "GET",
			headers: {
				"authorization": `Bearer ${token}`,
				"x-user-id": userId
			},
		});
		if (!res.ok) throw new Error(`Match history not found`);
		const { matchList } = (await res.json());

		ulHistoryList.innerHTML = "";
		const frag = document.createDocumentFragment();
		for (const match of matchList) {
			const p1Name: string = match.player1_name;
			const p2Name: string = match.player2_name;
			const winnerId: number = match.winner_id;
			const matchWon: boolean = String(match.winner_id) === String(userId);
			const p1Score: string = match.score_p1;
			const p2Score: string = match.score_p2;
			const gameType: string = match.game_type;
			const matchType: string = match.match_type;
			const playedAt: string = match.played_at;
			
			frag.appendChild(createLiHistoryItem(p1Name, p2Name, p1Score, p2Score, gameType, matchType, playedAt, matchWon, winnerId));
		}
		ulHistoryList.appendChild(frag);
	} catch (error) {
		console.error("Error displaying friends list:", error); // afficher msg dans une div pour le user
	}
}

function createLiHistoryItem(p1Name: string, p2Name: string, p1Score: string, p2Score: string, gameType: string, matchType: string, playedAt: string, matchWon: boolean, winnerId: number): HTMLLIElement {

	const li: HTMLLIElement = document.createElement('li');
	li.className = 'w-full grid grid-cols-[1fr_6fr] grid-rows-2 bg-opacity-50 border-b-2 border-white last:border-b-0';

	if (winnerId === 0) {
		li.classList.add('bg-dark');
	} else if (matchWon) {
		li.classList.add('bg-green-600');
	} else {
		li.classList.add('bg-red-600')
	}

	// #region icons //

	const iconsDiv: HTMLDivElement = document.createElement('div');
	iconsDiv.className = 'row-span-2 col-span-1 flex items-center justify-center gap-3 h-full w-full';

	const gameTypeIcon: HTMLImageElement = document.createElement('img');
	if (gameType === 'pong')
		gameTypeIcon.src = './assets/other/pong.png';
	else if (gameType === 'snake')
		gameTypeIcon.src = './assets/other/snake.png';
	gameTypeIcon.className = 'object-contain h-2/3 w-2/3';
	
	const matchTypeIcon: HTMLImageElement = document.createElement('img');
	if (matchType === 'remote')
		matchTypeIcon.src = './assets/other/versus-icon.svg';
	else if (matchType === 'tournament')
		matchTypeIcon.src = './assets/other/cup-icon.svg';
	matchTypeIcon.className = 'w-1/3 h-1/3 invert';

	iconsDiv.append(gameTypeIcon, matchTypeIcon);

	// #endregion icon //


	// #region resume //

	const resumeDiv: HTMLDivElement = document.createElement('div');
	resumeDiv.className = 'row-span-1 col-span-1 flex flex-row items-center justify-center gap-4 text-4xl';

	const p1NameDiv: HTMLDivElement = document.createElement('div');
	p1NameDiv.textContent = p1Name;

	const p2NameDiv: HTMLDivElement = document.createElement('div');
	p2NameDiv.textContent = p2Name;

	const ScoreDiv: HTMLDivElement = document.createElement('div');
	ScoreDiv.textContent = p1Score + ' - ' + p2Score;

	resumeDiv.append(p1NameDiv, ScoreDiv, p2NameDiv);

	// #endregion resume //

	// #region date //

	const playedAtDiv: HTMLDivElement = document.createElement('div');
	playedAtDiv.className = 'row-span-1 col-span-1 flex flex-row items-center justify-evenly text-xl';

	const fullDate: Date = new Date(playedAt);
	const day = String(fullDate.getDate()).padStart(2, '0');
	const month = String(fullDate.getMonth() + 1).padStart(2, '0');
	const year = String(fullDate.getFullYear()).slice(-2);
	const hours = String(fullDate.getHours()).padStart(2, '0');
	const minutes = String(fullDate.getMinutes()).padStart(2, '0');
	playedAtDiv.textContent = `${day}/${month}/${year} - ${hours}:${minutes}`;
	
	// #endregion date //

	li.append(iconsDiv, resumeDiv, playedAtDiv);

	return (li);
}
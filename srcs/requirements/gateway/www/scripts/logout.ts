export function logout () {
	// Clear si possible
	localStorage.removeItem("jwt");
	localStorage.removeItem("userId");
	localStorage.removeItem("accountActiveTab");
	document.body.classList.remove("loggedIn");
	// Maybe faire en sorte de ramener sur la homePage ? attention au setTimeOut si le user clique sur une autre page avant la fin du to
}
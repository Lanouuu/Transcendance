export function logout () {
	localStorage.removeItem("jwt");
	localStorage.removeItem("userId");
	document.body.classList.remove("loggedIn");
	// Maybe faire en sorte de ramener sur la homePage ? attention au setTimeOut si le user clique sur une autre page avant la fin du to
}
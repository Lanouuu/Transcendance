const AUTH_URL: string = "https://localhost:8443/auth_service";

export async function logout () {
	const token = sessionStorage.getItem("jwt");
  	const userId = sessionStorage.getItem("userId");
  	if (!token || !userId) return;

  	try {
  	  const res = await fetch(`${AUTH_URL}/logout`, {
  	    method: "POST",
  	    headers: {
  	      "Authorization": `Bearer ${token}`,
  	      "x-user-id": userId
  	    }
  	  });

  	  if (!res.ok) {
		console.warn("Logout request failed:", await res.text());
  	  }

  	} catch (err) {
		console.error("Logout fetch error:", err);
  	} finally {
		sessionStorage.removeItem("jwt");
		sessionStorage.removeItem("userId");
		sessionStorage.removeItem("accountActiveTab");
		document.body.classList.remove("loggedIn");
		window.dispatchEvent(new Event("user:logout"));
  	}
}
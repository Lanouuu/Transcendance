// import fetch from "node-fetch";

const USERS_URL: string = "https://localhost:8443/users";
const AUTH_URL: string = "https://localhost:8443/auth_service";

interface User {
  name: string;
  mail: string;
  password: string;
}

const users: User[] = [
  { name: "alice", mail: "a@test.fr", password: "test" },
  { name: "bob", mail: "b@test.fr", password: "test" }
];

async function createUser(user: User): Promise<Response> {
  return fetch(`${AUTH_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: user.name, mail: user.mail, password: user.password, enable2FA: false })
  });
}

interface LoginResponse {
  token?: string;
  accessToken?: string;
  [key: string]: any;
}

async function login(user: User): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mail: user.mail, password: user.password })
  });
  return res.json();
}

async function logout(userId: string, token: string): Promise<Response> {
  return fetch(`${AUTH_URL}/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-user-id": userId || ""
      }
  });
}

async function sendInvite(fromId: string, friendName: string, token: string): Promise<Response> {
  return fetch(`${USERS_URL}/send-invit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", 
      "authorization": `Bearer ${token}`,
      "x-user-id": fromId  },
    body: JSON.stringify({ friendName })
  });
}

async function acceptInvite(userID: string, body: { friendID: number | string }, token: string): Promise<Response> {
  return fetch(`${USERS_URL}/accept-invit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", 
      "authorization": `Bearer ${token}`,
      "x-user-id": userID  },
    body: JSON.stringify(body)
  });
}

export async function initTest(): Promise<void> {
  try {

    // création users
    for (const u of users) {
      await createUser(u);
    }

    // login pour récupérer tokens
    const tokens: { [name: string]: string } = {};
    for (const u of users) {
      const j = await login(u);
      let token = "";
      if (typeof j.token === "string") token = j.token;
      else if (typeof j.accessToken === "string") token = j.accessToken;
      else if (typeof j === "string") token = j;
      tokens[u.name] = token;
      console.log(`${u.name} token:`, tokens[u.name]);
    }

    await sendInvite("1", "bob", tokens["alice"]);
    await acceptInvite("2", { friendID: 1 }, tokens["bob"]);

    await logout('1', tokens['alice']);
    await logout('2', tokens['bob']);

    console.log("Seed complete");
  } catch (err) {
    console.error("Seed failed:", err);
  }
}
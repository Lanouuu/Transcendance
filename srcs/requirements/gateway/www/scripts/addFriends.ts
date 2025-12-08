// import fetch from "node-fetch";

const USERS_URL: string = `${window.location.origin}/users`;
const AUTH_URL: string = `${window.location.origin}/auth_service`;

interface User {
  name: string;
  mail: string;
  password: string;
}

const users: User[] = [
  { name: "alice", mail: "a@test.fr", password: "test" },
  { name: "bob", mail: "b@test.fr", password: "test" },
  { name: "cat", mail: "c@test.fr", password: "test" },
  { name: "david", mail: "d@test.fr", password: "test" },
  { name: "eric", mail: "e@test.fr", password: "test" },
  { name: "frank", mail: "f@test.fr", password: "test" },
  { name: "gavin", mail: "g@test.fr", password: "test" },
  { name: "hue", mail: "h@test.fr", password: "test" },
  { name: "iris", mail: "i@test.fr", password: "test" },
  { name: "jacob", mail: "j@test.fr", password: "test" },
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
    await sendInvite("1", "cat", tokens["alice"]);
    await sendInvite("1", "david", tokens["alice"]);
    await sendInvite("1", "eric", tokens["alice"]);
    await sendInvite("1", "frank", tokens["alice"]);
    await sendInvite("1", "gavin", tokens["alice"]);
    await sendInvite("1", "hue", tokens["alice"]);
    await sendInvite("1", "iris", tokens["alice"]);
    await sendInvite("1", "jacob", tokens["alice"]);

    await acceptInvite("2", { friendID: 1 }, tokens["bob"]);
    await acceptInvite("3", { friendID: 1 }, tokens["cat"]);
    await acceptInvite("4", { friendID: 1 }, tokens["david"]);
    await acceptInvite("5", { friendID: 1 }, tokens["eric"]);
    await acceptInvite("6", { friendID: 1 }, tokens["frank"]);
    await acceptInvite("7", { friendID: 1 }, tokens["gavin"]);
    await acceptInvite("8", { friendID: 1 }, tokens["hue"]);
    await acceptInvite("9", { friendID: 1 }, tokens["iris"]);
    await acceptInvite("10", { friendID: 1 }, tokens["jacob"]);

    await logout('1', tokens['alice']);
    await logout('2', tokens['bob']);
    await logout('3', tokens['cat']);
    await logout('4', tokens['david']);
    await logout('5', tokens['eric']);
    await logout('6', tokens['frank']);
    await logout('7', tokens['gavin']);
    await logout('8', tokens['hue']);
    await logout('9', tokens['iris']);
    await logout('10', tokens['jacob']);

    console.log("Seed complete");
  } catch (err) {
    console.error("Seed failed:", err);
  }
}
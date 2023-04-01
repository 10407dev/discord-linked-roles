require("dotenv").config();
const { env } = require("process");
const app = require("express")();

app.use(require("cookie-parser")(env.COOKIE_SECRET));

app.get("/linked-role", (_req, res) => {
	const state = crypto.randomUUID();
	const query = new URLSearchParams({
		client_id: env.DISCORD_CLIENT_ID,
		response_type: "code",
		state: state,
		scope: "role_connections.write identify",
		prompt: "consent",
	});

	res.cookie("clientState", state, { maxAge: 1000 * 60 * 5, signed: true });
	res.redirect(`https://discord.com/api/oauth2/authorize?${query.toString()}`);
});

app.get("/discord-oauth-callback", async (req, res) => {
	if (req.signedCookies.clientState !== req.query["state"]) {
		console.error("State verification failed.");
		return res.sendStatus(403);
	}

	const tokens = await fetch("https://discord.com/api/v10/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: env.DISCORD_CLIENT_ID,
			client_secret: env.DISCORD_CLIENT_SECRET,
			grant_type: "authorization_code",
			code: req.query["code"],
		}),
	}).then((response) => {
		if (response.ok) return response.json();
		else throw new Error(`Error fetching OAuth tokens: [${response.status}] ${response.statusText}`);
	});

	await fetch(`https://discord.com/api/v10/users/@me/applications/${env.DISCORD_CLIENT_ID}/role-connection`, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${tokens.access_token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ platform_name: "Empire of Man Linked Roles" }),
	}).then((response) => {
		if (!response.ok) throw new Error(`Error pushing discord metadata: [${response.status}] ${response.statusText}`);
		else res.sendStatus(200);
	});
});

const port = env.PORT || 10407;
app.listen(port, () => console.log(`Listening on port ${port}`));

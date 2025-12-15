const fs = require("fs");
const puppeteer = require("puppeteer");
const discord = require("discord.js");
const dotenv = require("dotenv");

dotenv.config({ quiet: true });

(async () => {
	const setup = fs.existsSync(__dirname + "/profile");
	const browser = await puppeteer.launch({
		headless: setup ? "new" : false,
		userDataDir: __dirname + "/profile"
	});

	const page = (await browser.pages())[0];
	await page.goto("https://open.spotify.com");

	if (setup) {
		console.log("Please log in to Spotify in the opened browser window, then close it and restart the script.");
		return;
	}

	await page.waitForSelector("button[data-testid='control-button-playpause']");

	const bot = new discord.Client({ intents: [discord.GatewayIntentBits.Guilds, discord.GatewayIntentBits.GuildPresences] });
	bot.on("clientReady", () => {
		console.log(`Logged in as ${bot.user.tag}`);
	});
	await bot.login(process.env.DISCORD_BOT_TOKEN);

	const playPause = async () => await page.click("button[data-testid='control-button-playpause']");
	const seek = async (percent) => {
		const bar = await page.$("div[data-testid='playback-progressbar']")
		const box = await bar.boundingBox();
		await page.mouse.click(box.x + box.width * percent / 100, box.y + box.height / 2);
	};
	const isPlaying = async () => {
		const button = await page.$("button[data-testid='control-button-playpause']");
		const label = await button.evaluate(node => node.getAttribute("aria-label"));
		return label === "Pause";
	};
	const play = async (id) => {
		await page.goto(`https://open.spotify.com/track/${id}`);
		await page.waitForSelector("div[data-testid='action-bar-row']");
		const bar = await page.$("div[data-testid='action-bar-row']");
		await bar.click("button[data-testid='play-button']");
	};

	let oldMusic = null;
	const handlePresence = async (presence) => {
		const spotify = presence.activities.find((activity) => activity.name === "Spotify");
		if (spotify && oldMusic !== spotify.syncId) {
			oldMusic = spotify.syncId;
			await play(spotify.syncId);
			const duration = spotify.timestamps.end.getTime() - spotify.timestamps.start.getTime();
			const elapsed = Date.now() - spotify.timestamps.start.getTime();
			await seek((elapsed / duration) * 100);
			console.log("Playing:", spotify.state);
		} else if (!spotify && oldMusic) {
			oldMusic = null;
			if (await isPlaying())
				await playPause();
			console.log("Pausing");
		}
	};

	const guild = await bot.guilds.fetch(process.env.DISCORD_GUILD_ID);
	const member = await guild.members.fetch(process.env.DISCORD_USER_ID);
	handlePresence(member.presence);
	bot.on("presenceUpdate", (oldPresence, newPresence) => {
		if (newPresence.userId !== member.id) return;
		handlePresence(newPresence);
	});
})();

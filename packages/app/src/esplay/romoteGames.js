// Moonbase reads ROMs straight from disk and looks their art up in libretro,
// which misses names like "Ace of Aces (NA)". ROMote has already scraped
// those same files into Emby's own Game items, so EsPlay takes the box art
// and details from there, matching by file name and then by title.
import {api, getServerUrl} from '../services/jellyfinApi';
import {getGame, getLibraries} from '../services/gamesApi';
import {getImageUrl} from '../utils/helpers';

const PAGE = 1000;

let pending = null;
let loaded = null;
let loadedFor = null;

const baseName = (path) => String(path || '').split(/[\\/]/).pop().toLowerCase();

// "Ace of Aces (NA)" and "Ace of Aces" are the same game for matching.
const titleKey = (title) => String(title || '')
	.toLowerCase()
	.replace(/\([^)]*\)|\[[^\]]*\]/g, '')
	.replace(/[^a-z0-9]+/g, ' ')
	.trim();

const fetchIndex = async () => {
	const byFile = {};
	const byTitle = {};
	for (let start = 0; ; start += PAGE) {
		const result = await api.getItems({
			IncludeItemTypes: 'Game',
			Recursive: true,
			StartIndex: start,
			Limit: PAGE,
			Fields: 'Path,Overview,Genres,ProductionYear'
		});
		const items = result?.Items || [];
		items.forEach((item) => {
			const game = {
				id: item.Id,
				name: item.Name,
				imageTag: item.ImageTags?.Primary || null,
				overview: item.Overview || null,
				year: item.ProductionYear || null,
				genres: item.Genres || []
			};
			if (item.Path && !byFile[baseName(item.Path)]) byFile[baseName(item.Path)] = game;
			if (!byTitle[titleKey(item.Name)]) byTitle[titleKey(item.Name)] = game;
		});
		if (items.length < PAGE) break;
	}
	loaded = {byFile, byTitle};
	return loaded;
};

const load = () => {
	const server = getServerUrl();
	if (loadedFor !== server) {
		loadedFor = server;
		pending = null;
		loaded = null;
	}
	if (!pending) {
		const attempt = fetchIndex();
		pending = attempt;
		// A failed load is asked for again next time instead of being kept.
		attempt.catch(() => {
			if (pending === attempt) pending = null;
		});
	}
	return pending.catch(() => ({byFile: {}, byTitle: {}}));
};

const find = (index, game) =>
	index.byFile[baseName(game.fileName)] || index.byTitle[titleKey(game.title)] || null;

// The ROMote record for a Moonbase game, or null.
export const matchRomoteGame = async (game) => (game ? find(await load(), game) : null);

// Every match for games, keyed by the Moonbase game id.
export const matchRomoteGames = async (games) => {
	const index = await load();
	const found = {};
	(games || []).forEach((game) => {
		const match = find(index, game);
		if (match) found[game.id] = match;
	});
	return found;
};

export const romoteImageUrl = (match, maxWidth) => (match?.imageTag ?
	getImageUrl(getServerUrl(), match.id, 'Primary', {maxWidth, tag: match.imageTag}) :
	null);

// The Moonbase game and library for an Emby Game item, or null when its ROM isn't
// in a Moonbase game library. Moonbase names a game by its ROM's path in base64url
// without padding, and the ROMote item points at that same file.
export const findMoonbaseGame = async (itemId) => {
	let gameId, libraries;
	try {
		const item = await api.getItem(itemId);
		if (!item?.Path) return null;
		gameId = btoa(unescape(encodeURIComponent(item.Path)))
			.replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
		libraries = await getLibraries();
	} catch (e) {
		return null;
	}
	for (const library of libraries || []) {
		try {
			// A ROM outside this library answers 404.
			const game = await getGame(library.id, gameId);
			if (game) return {library: {Id: library.id, Name: library.name}, game};
		} catch (e) {
			// Not in this library.
		}
	}
	return null;
};

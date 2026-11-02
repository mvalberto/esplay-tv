// EsPlay: live TV and genre answers kept between visits and app starts, so a page shows
// what it had at once and refreshes behind it. Channel logos and posters need
// nothing here: their URLs carry the image tag, so the TV's HTTP cache keeps them.
import {getFromStorage, saveToStorage} from '../services/storage';

const STORAGE_KEY = 'esplay_livetv_v1';
// Younger answers are used without asking the server again.
const FRESH_MS = 60 * 1000;
// Stored answers older than this are dropped when the app starts.
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

let owner = null;
let entries = {};
let pending = {};
let restoring = null;
let saveTimer = null;

// Only what the cards show of the current program goes to storage.
const slimChannel = (channel) => {
	const program = channel.CurrentProgram;
	if (!program) return channel;
	return {...channel, CurrentProgram: {Id: program.Id, Name: program.Name, StartDate: program.StartDate, EndDate: program.EndDate}};
};

const save = () => {
	clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		const stored = {};
		Object.keys(entries).forEach((key) => {
			const entry = entries[key];
			if (!entry.persist) return;
			stored[key] = {at: entry.at, value: Array.isArray(entry.value) && key.indexOf('row:') === 0 ? entry.value.map(slimChannel) : entry.value};
		});
		saveToStorage(STORAGE_KEY, {owner, entries: stored});
	}, 1000);
};

/** Reads the stored answers once for this server and user; another account starts empty. */
export const restoreLiveTvCache = (scope) => {
	if (owner !== scope) {
		owner = scope;
		entries = {};
		pending = {};
		restoring = getFromStorage(STORAGE_KEY).then((stored) => {
			if (!stored || stored.owner !== scope || !stored.entries || owner !== scope) return;
			const now = Date.now();
			Object.keys(stored.entries).forEach((key) => {
				const entry = stored.entries[key];
				if (!entries[key] && entry && now - entry.at < KEEP_MS) entries[key] = {...entry, persist: true};
			});
		}, () => {});
	}
	return restoring;
};

/** What is kept for the key, however old, or null. */
export const peekLiveTv = (key) => (entries[key] ? entries[key].value : null);

/**
 * The kept answer while it is fresh, otherwise the server's. A failed call
 * falls back to the kept answer. Callers asking at once share one request.
 */
export const loadLiveTv = (key, fetcher, {persist = false} = {}) => {
	const entry = entries[key];
	if (entry && Date.now() - entry.at < FRESH_MS) return Promise.resolve(entry.value);
	if (pending[key]) return pending[key];
	const scope = owner;
	const request = fetcher().then((value) => {
		if (owner === scope) {
			entries[key] = {at: Date.now(), value, persist};
			if (persist) save();
		}
		return value;
	}, (error) => {
		if (entry) return entry.value;
		throw error;
	});
	const settle = () => {
		if (pending[key] === request) delete pending[key];
	};
	request.then(settle, settle);
	pending[key] = request;
	return request;
};

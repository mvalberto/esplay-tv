// EsPlay sign in: the user types only username and password, the panel says
// which Emby server holds the account, and the app signs in there itself.

import {getDeviceInfo} from './jellyfinApi';

const PANEL_LOGIN_URL = 'https://panel.esplay.es/api/app/login';

// The panel may answer with the internal address, use the public HTTPS one.
const PUBLIC_ADDRESSES = {
	'194.164.172.201': 'https://ep01.esplay.es:8920',
	'5.250.191.4': 'https://ep02.esplay.es:8920'
};

export const publicAddress = (address) => {
	const host = String(address || '').replace(/^[a-z]+:\/\//i, '').split(/[:/]/)[0];
	return PUBLIC_ADDRESSES[host] || address;
};

const cacheKey = (username) => 'esplay_server_' + username.trim().toLowerCase();

export const getCachedServer = (username) => {
	try {
		return localStorage.getItem(cacheKey(username));
	} catch (e) {
		return null;
	}
};

export const setCachedServer = (username, address) => {
	try {
		if (address) localStorage.setItem(cacheKey(username), address);
		else localStorage.removeItem(cacheKey(username));
	} catch (e) { /* storage unavailable */ }
};

const LAST_USERNAME_KEY = 'esplay_last_username';

export const getLastUsername = () => {
	try {
		return localStorage.getItem(LAST_USERNAME_KEY) || '';
	} catch (e) {
		return '';
	}
};

export const setLastUsername = (username) => {
	try {
		localStorage.setItem(LAST_USERNAME_KEY, username.trim());
	} catch (e) { /* storage unavailable */ }
};

// Resolves to {address}, or {error: 'credentials' | 'attempts' | 'outdated' | 'unavailable', message?}
export const panelLogin = async (username, password) => {
	const {appName, appVersion} = getDeviceInfo();
	let response;
	try {
		response = await fetch(PANEL_LOGIN_URL, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({username: username.trim(), password, appName, appVersion})
		});
	} catch (e) {
		return {error: 'unavailable'};
	}

	let body = null;
	try {
		body = await response.json();
	} catch (e) { /* no body */ }

	if (response.status === 200 && body?.address) return {address: publicAddress(body.address)};
	if (response.status === 400 || response.status === 401) return {error: 'credentials'};
	if (response.status === 426) return {error: 'outdated', message: body?.message || null};
	if (response.status === 429) return {error: 'attempts'};
	return {error: 'unavailable'};
};

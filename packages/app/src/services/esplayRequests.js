// EsPlay's own requests and reports, kept by the panel. The panel knows who is asking from the
// app's Emby session: its token, this TV's device id and the server it belongs to.
import {getApiKey, getDeviceId, getServerUrl} from './jellyfinApi';

const BASE = 'https://panel.esplay.es/api/app/solicitudes';

export class EsplayRequestError extends Error {
	constructor (status, data) {
		super((data && data.error) || 'http_' + status);
		this.status = status;
		this.data = data || {};
	}
}

const call = async (path, body) => {
	let response;
	try {
		response = await fetch(BASE + path, {
			method: body ? 'POST' : 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-Emby-Token': getApiKey() || '',
				'X-Emby-Device-Id': getDeviceId() || '',
				'X-Emby-Server': getServerUrl() || ''
			},
			body: body ? JSON.stringify(body) : undefined
		});
	} catch (e) {
		throw new EsplayRequestError(0, {error: 'sin_conexion'});
	}
	let data = null;
	try {
		data = await response.json();
	} catch (e) { /* not JSON */ }
	if (!response.ok) throw new EsplayRequestError(response.status, data);
	return data;
};

export const searchTitles = (query) => call('/buscar?q=' + encodeURIComponent(query));
export const getTitle = (mediaType, tmdbId) => call('/detalle/' + mediaType + '/' + tmdbId);
export const requestTitle = (mediaType, tmdbId, note, acceptRisk) =>
	call('/solicitar', {media_type: mediaType, tmdb_id: tmdbId, note: note || '', acepta_riesgo: acceptRisk === true});
export const reportItem = (embyItemId, category, note) =>
	call('/reportar', {emby_item_id: embyItemId, category, note: note || ''});
export const myRequests = () => call('/mis');

export const REPORT_CATEGORIES = ['audio', 'imagen', 'subtitulos', 'calidad'];

// What the panel's error codes mean to the viewer.
export const errorText = (err, $L) => {
	const code = err && err.message;
	switch (code) {
		case 'limite_semanal':
			return $L('You have used your requests for this week. The next one frees up on {date}.').replace('{date}', err.data.libera || '');
		case 'limite_diario':
			return $L('You have sent the maximum reports for today. Try again from {date}.').replace('{date}', err.data.libera || '');
		case 'ya_disponible':
			return $L('This title is already on EsPlay.');
		case 'no_autenticado':
			return $L('EsPlay could not confirm your session. Sign out and in again.');
		case 'sin_conexion':
			return $L('Could not reach EsPlay. Check your connection.');
		default:
			return $L('Something went wrong. Try again in a moment.');
	}
};

// Opening the report dialog from any detail screen without threading props through all of them.
export const openReportDialog = (item) => {
	window.dispatchEvent(new CustomEvent('esplay:report', {detail: {item}}));
};

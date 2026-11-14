// EsPlay: everyone gets the same media bar, whatever is stored or synced. The
// EsPlay showcase with trailer and sound, the 5 newest titles of the Películas
// and Series libraries, advancing every 10 seconds, with IMDb, TMDB and Rotten
// Tomatoes ratings.
export const ESPLAY_FORCE_MEDIA_BAR = true;

export const ESPLAY_MEDIA_BAR_SETTINGS = ESPLAY_FORCE_MEDIA_BAR && {
	featuredBarStyle: 'moonfin',
	featuredContentType: 'both',
	featuredItemCount: 5,
	featuredTrailerPreview: true,
	featuredTrailerMuted: false,
	autoAdvance: true,
	autoAdvanceInterval: 10,
	mediaBarSourceType: 'library',
	mediaBarLibraryIds: [],
	mediaBarCollectionIds: [],
	mediaBarExternalLists: [],
	excludedGenres: [],
	mediaBarMdblistEnabled: true,
	mediaBarMdblistRatingSources: ['imdb', 'tmdb', 'tomatoes']
};

// The libraries the bar draws from, by name in lower case.
const LIBRARIES = ['películas', 'series'];

// The newest usable titles of those libraries, the newest of each in turn.
export const esplayNewestFeatured = async (api, count, isUsable) => {
	if (!ESPLAY_FORCE_MEDIA_BAR) return [];
	const views = (await api.getLibraries().catch(() => null))?.Items || [];
	const picked = views.filter((view) => LIBRARIES.includes((view.Name || '').trim().toLowerCase()));
	const lists = await Promise.all(picked.map((view) =>
		api.getLatestMedia(view.Id, 40, view.CollectionType === 'tvshows' ? 'Series' : 'Movie')
			.then((result) => (Array.isArray(result) ? result : result?.Items || []).filter(isUsable))
			.catch(() => [])
	));
	const items = [];
	for (let i = 0; items.length < count && lists.some((list) => i < list.length); i++) {
		for (const list of lists) {
			if (i < list.length && items.length < count) items.push(list[i]);
		}
	}
	return items;
};

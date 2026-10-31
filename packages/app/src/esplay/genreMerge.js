// EsPlay's servers hold genres in two languages, "Action" next to "Acción",
// because some items took their metadata in English. The genre screens show
// each genre once, under its Spanish name, with the titles of both.
const SPANISH_GENRES = {
	'action': 'Acción',
	'adventure': 'Aventura',
	'action & adventure': 'Acción y aventura',
	'animation': 'Animación',
	'anime': 'Anime',
	'biography': 'Biografía',
	'children': 'Infantil',
	'comedy': 'Comedia',
	'crime': 'Crimen',
	'documentary': 'Documental',
	'drama': 'Drama',
	'family': 'Familia',
	'fantasy': 'Fantasía',
	'film-noir': 'Cine negro',
	'food': 'Cocina',
	'game show': 'Concursos',
	'history': 'Historia',
	'home and garden': 'Hogar y jardín',
	'horror': 'Terror',
	'kids': 'Infantil',
	'mini-series': 'Miniserie',
	'music': 'Música',
	'musical': 'Musical',
	'mystery': 'Misterio',
	'news': 'Noticias',
	'reality': 'Reality',
	'romance': 'Romance',
	'science fiction': 'Ciencia ficción',
	'sci-fi': 'Ciencia ficción',
	'sci-fi & fantasy': 'Ciencia ficción y fantasía',
	'short': 'Cortometraje',
	'soap': 'Telenovela',
	'sport': 'Deporte',
	'sports': 'Deportes',
	'suspense': 'Suspense',
	'talk': 'Entrevistas',
	'talk show': 'Entrevistas',
	'thriller': 'Suspense',
	'travel': 'Viajes',
	'tv movie': 'Película de TV',
	'war': 'Bélica',
	'war & politics': 'Bélica y política',
	'western': 'Western'
};

// The Spanish name for a genre the providers wrote in English, else the name.
// A filter of several names ("Acción|Action") is named by its first one.
export const esplayGenreName = (name) => {
	const first = String(name || '').split('|')[0];
	return SPANISH_GENRES[first.trim().toLowerCase()] || first;
};

const keyOf = (name) => esplayGenreName(name)
	.toLowerCase()
	.replace(/[áà]/g, 'a')
	.replace(/[éè]/g, 'e')
	.replace(/[íì]/g, 'i')
	.replace(/[óò]/g, 'o')
	.replace(/[úùü]/g, 'u')
	.trim();

// Folds genre items that share a Spanish name into one, named in Spanish.
// EsPlayGenreNames holds every server name with "|", which Emby's Genres
// filter reads as "any of"; the first item's Id and artwork are kept.
export const mergeGenresBySpanishName = (genres) => {
	const merged = new Map();
	(genres || []).forEach((genre) => {
		const name = genre.Name || '';
		const key = keyOf(name);
		const existing = merged.get(key);
		if (!existing) {
			merged.set(key, {...genre, Name: esplayGenreName(name), EsPlayGenreNames: name});
			return;
		}
		if (esplayGenreName(name) === name) existing.Name = name;
		existing.EsPlayGenreNames += '|' + name;
		Object.keys(genre).forEach((field) => {
			if (/Count$/.test(field) && typeof genre[field] === 'number') {
				existing[field] = (existing[field] || 0) + genre[field];
			}
		});
	});
	return Array.from(merged.values());
};

// An item's genres in Spanish, each once.
export const esplayGenres = (genres) => (genres || [])
	.map(esplayGenreName)
	.filter((name, index, all) => all.indexOf(name) === index);

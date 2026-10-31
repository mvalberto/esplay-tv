// EsPlay: where the live TV page should open next, set by Home, search or
// favorites just before they switch to it: a tag's channels or a channel's page.
let pending = null;

export const setPendingLiveTv = (intent) => {
	pending = intent;
};

export const takePendingLiveTv = () => {
	const intent = pending;
	pending = null;
	return intent;
};

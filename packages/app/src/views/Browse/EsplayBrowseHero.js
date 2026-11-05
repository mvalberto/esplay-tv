import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {formatDuration, getBackdropId, getImageUrl, getLogoUrl, toAbsoluteImageUrl} from '../../utils/helpers';
import {isLiveTvProgram} from '../../utils/liveTvLibrary';
import {EsplayLiveHero} from '../../components/MediaCard/EsplayLiveCard';

import css from './EsplayBrowseHero.module.less';

// EsPlay: the top of Home while the rows have focus, as the live TV showcase. The title under
// the remote shows its picture on the right, fading into the dark behind its text, and when it
// has a preview the video plays there instead of inside the card.

const PREVIEW_KEY = 'esplay-hero';
// Focus crossing a row quickly only redraws the top once it rests.
const SETTLE_MS = 150;

const pictureOf = (item, serverUrl) => {
	const target = item.Type === 'Genre' && item._representative ? item._representative : item;
	const base = target._serverUrl || serverUrl;
	// A channel tag's tile stands for the tag, whose picture is its own.
	if (target.esplayTagThumb) return getImageUrl(base, target.esplayTagId, 'Thumb', {tag: target.esplayTagThumb, maxWidth: 1280, quality: 80});
	if (target._externalBackdropUrl) return toAbsoluteImageUrl(target._externalBackdropUrl, base);
	const backdropId = getBackdropId(target);
	if (backdropId) return getImageUrl(base, backdropId, 'Backdrop', {maxWidth: 1280, quality: 80});
	for (const type of ['Thumb', 'Primary']) {
		const tag = target.ImageTags?.[type];
		if (tag) return getImageUrl(base, target.Id, type, {tag, maxWidth: 1280, quality: 80});
	}
	return null;
};

const detailsOf = (item) => {
	const parts = [];
	if (item.Type === 'Episode') {
		const number = item.ParentIndexNumber != null && item.IndexNumber != null
			? `T${item.ParentIndexNumber}:E${item.IndexNumber}`
			: '';
		parts.push([number, item.Name].filter(Boolean).join(' · '));
	}
	if (item.ProductionYear) parts.push(String(item.ProductionYear));
	if (item.OfficialRating) parts.push(item.OfficialRating);
	if (item.CommunityRating) parts.push(`★ ${Number(item.CommunityRating).toFixed(1)}`);
	if (item.RunTimeTicks && item.Type !== 'Series') parts.push(formatDuration(item.RunTimeTicks));
	if (item.Genres?.length) parts.push(item.Genres.slice(0, 3).join(', '));
	return parts.join(' · ');
};

const MediaHero = ({item, serverUrl, phase, frameRef}) => {
	const picture = pictureOf(item, serverUrl);
	const logo = getLogoUrl(item._serverUrl || serverUrl, item, {maxWidth: 600});
	const [failed, setFailed] = useState({});
	const onPictureError = useCallback(() => setFailed((prev) => ({...prev, [picture]: true})), [picture]);
	const onLogoError = useCallback(() => setFailed((prev) => ({...prev, [logo]: true})), [logo]);
	const title = item.Type === 'Episode' && item.SeriesName ? item.SeriesName : item.Name;
	const details = detailsOf(item);
	const playing = phase === 'playing';
	return (
		<>
			<div className={css.art}>
				{picture && !failed[picture] && (
					<div className={`${css.pictureFade} ${playing ? css.hidden : ''}`}>
						<img key={picture} className={css.picture} src={picture} alt="" onError={onPictureError} />
					</div>
				)}
				<div ref={frameRef} className={`${css.video} ${playing ? '' : css.hidden}`} />
				{playing && <div className={`${css.videoShade} ${css.shadeLeft}`} />}
				{playing && <div className={`${css.videoShade} ${css.shadeBottom}`} />}
			</div>
			<div className={css.text}>
				{logo && !failed[logo] ? (
					<img key={logo} className={css.logo} src={logo} alt={title} onError={onLogoError} />
				) : (
					<div className={css.title}>{title}</div>
				)}
				{details && <div className={css.details}>{details}</div>}
				{item.Overview && <div className={css.overview}>{item.Overview}</div>}
			</div>
		</>
	);
};

const EsplayBrowseHero = forwardRef(({serverUrl, preview, sidebar}, ref) => {
	const [item, setItem] = useState(null);
	const [phase, setPhase] = useState('idle');
	const timerRef = useRef(null);

	useImperativeHandle(ref, () => ({
		show: (next) => {
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => setItem(next || null), SETTLE_MS);
		}
	}), []);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	useEffect(() => {
		if (!preview) return undefined;
		return preview.subscribe(PREVIEW_KEY, setPhase);
	}, [preview]);

	// The controller plays one title at a time, so a new one cancels the last before it waits its turn.
	useEffect(() => {
		if (!preview || !item || isLiveTvProgram(item)) return undefined;
		preview.schedule(PREVIEW_KEY, item);
		return () => preview.cancel(PREVIEW_KEY);
	}, [preview, item]);

	const frameRef = useCallback((el) => preview?.attachFrame(PREVIEW_KEY, el), [preview]);

	return (
		<div className={`${css.hero} ${sidebar ? css.sidebar : ''}`}>
			{item && (isLiveTvProgram(item)
				? <EsplayLiveHero item={item} serverUrl={serverUrl} />
				: <MediaHero key={item.Id} item={item} serverUrl={serverUrl} phase={phase} frameRef={frameRef} />
			)}
		</div>
	);
});

export default EsplayBrowseHero;

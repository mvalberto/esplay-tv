import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import $L from '@enact/i18n/$L';
import {getImageUrl} from '../../utils/helpers';
import {isLiveTvProgram} from '../../utils/liveTvLibrary';

import css from './EsplayLiveCard.module.less';

const SpottableDiv = Spottable('div');

// EsPlay: the live TV of the home, as a showcase. The program airing now that has focus fills
// the top of its row, picture and all, over small cards of everything else on; the channel tags
// sit below as compact cards with their number in red, the live TV page first.

const PROGRAM_CARD = {width: 320, height: 180};
const TAG_CARD = {width: 300, height: 110};

const clock = (date) => `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`;

const airing = (item) => {
	const start = item?.StartDate ? new Date(item.StartDate) : null;
	const end = item?.EndDate ? new Date(item.EndDate) : null;
	if (!start || !end || isNaN(start) || isNaN(end) || end <= start) return null;
	const now = Date.now();
	return {
		times: `${clock(start)} – ${clock(end)}`,
		percent: Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)),
		minutesLeft: Math.max(0, Math.round((end - now) / 60000))
	};
};

// The program's own pictures in [kinds] order ('thumb' is wide, 'poster' upright), then its
// channel's logo. One that fails hands over to the next, and with none the channel's name stands in.
const usePicture = (item, serverUrl, kinds, artWidth) => {
	const pictures = useMemo(() => {
		if (!isLiveTvProgram(item)) return [];
		const list = [];
		for (const kind of kinds) {
			const type = kind === 'thumb' ? 'Thumb' : 'Primary';
			const tag = item.ImageTags?.[type];
			if (tag) list.push({kind, url: getImageUrl(serverUrl, item.Id, type, {tag, maxWidth: artWidth, quality: 80})});
		}
		if (item.ChannelPrimaryImageTag) {
			list.push({kind: 'logo', url: getImageUrl(serverUrl, item.ChannelId, 'Primary', {tag: item.ChannelPrimaryImageTag, maxWidth: 400, quality: 90})});
		}
		return list;
	}, [item, serverUrl, kinds, artWidth]);
	const [failed, setFailed] = useState(() => new Set());
	const picture = pictures.find((p) => !failed.has(p.url));
	const onError = useCallback(() => {
		if (picture) setFailed((prev) => new Set(prev).add(picture.url));
	}, [picture]);
	return [picture, onError];
};

// A wide picture first where the guide has one; most only bring a poster, cropped to fit.
const ART_KINDS = ['thumb', 'poster'];

const TvIcon = () => (
	<svg className={css.tvIcon} viewBox="0 0 24 21" fill="none" stroke="#E71414" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<rect x="2" y="6" width="20" height="13" rx="2" />
		<path d="m7.5 2 4.5 4 4.5-4" />
		<path d="m10 10 5 2.5-5 2.5z" fill="#E71414" />
	</svg>
);

/** A program airing now at the top of Home, when it is the one under the remote. */
export const EsplayLiveHero = ({item, serverUrl}) => {
	const itemServerUrl = item?._serverUrl || serverUrl;
	const [picture, onError] = usePicture(item, itemServerUrl, ART_KINDS, 1280);
	if (!item) return null;
	const now = airing(item);
	// The picture fades out towards the text and the row below, into whatever is behind it.
	return (
		<div className={css.hero}>
			{picture && picture.kind !== 'logo' && (
				<div className={css.heroArtFade}>
					<img key={picture.url} className={css.heroArt} src={picture.url} alt="" onError={onError} />
				</div>
			)}
			{picture?.kind === 'logo' && (
				<img key={picture.url} className={css.heroLogo} src={picture.url} alt="" onError={onError} />
			)}
			<div className={css.heroText}>
				<div className={css.badges}>
					{item.ChannelName && <span className={css.channelChip}>{item.ChannelName}</span>}
					<span className={css.liveBadge}>{$L('LIVE')}</span>
				</div>
				<div className={css.heroTitle}>{item.Name}</div>
				{now && (
					<div className={css.heroTime}>
						{now.times} · {$L('{minutes} min left').replace('{minutes}', now.minutesLeft)}
					</div>
				)}
				{now && (
					<div className={css.heroProgress}>
						<div className={css.progressFill} style={{width: `${now.percent}%`}} />
					</div>
				)}
				{item.Overview && <div className={css.heroOverview}>{item.Overview}</div>}
			</div>
		</div>
	);
};

const EsplayLiveCard = ({
	item,
	serverUrl,
	onSelect,
	onFocusItem,
	onFocused,
	spotlightId,
	onSpotlightLeft,
	onSpotlightRight,
	isFocused = false
}) => {
	const focusTimeoutRef = useRef(null);
	const itemServerUrl = item?._serverUrl || serverUrl;
	const isProgram = isLiveTvProgram(item);
	const [picture, onError] = usePicture(item, itemServerUrl, ART_KINDS, 480);

	useEffect(() => () => clearTimeout(focusTimeoutRef.current), []);

	const handleFocus = useCallback(() => {
		onFocused?.(item?.Id || null);
		clearTimeout(focusTimeoutRef.current);
		focusTimeoutRef.current = setTimeout(() => onFocusItem?.(item), 50);
	}, [item, onFocusItem, onFocused]);

	const handleClick = useCallback(() => onSelect?.(item), [item, onSelect]);

	const size = isProgram ? PROGRAM_CARD : TAG_CARD;
	const tagMatch = /^(\d+)\s+(.*)$/.exec(item?.Name || '');
	const now = isProgram ? airing(item) : null;

	let art;
	if (isProgram) {
		art = (
			<>
				{picture ? (
					<img
						key={picture.url}
						className={picture.kind === 'logo' ? css.logo : css.art}
						src={picture.url}
						alt=""
						onError={onError}
					/>
				) : (
					<div className={css.channelName}>{item.ChannelName || item.Name}</div>
				)}
				{now && (
					<div className={css.edgeProgress}>
						<div className={css.progressFill} style={{width: `${now.percent}%`}} />
					</div>
				)}
			</>
		);
	} else if (item?.esplayTagId) {
		art = (
			<>
				{item.esplayTagThumb && (
					<img
						className={css.art}
						src={getImageUrl(itemServerUrl, item.esplayTagId, 'Thumb', {tag: item.esplayTagThumb, maxWidth: 480, quality: 80})}
						alt=""
					/>
				)}
				<div className={item.esplayTagThumb ? css.tileOnArt : css.tile}>
				{tagMatch && <span className={css.tagNumber}>{tagMatch[1]}</span>}
				<span className={css.tagName}>{tagMatch ? tagMatch[2] : item.Name}</span>
				</div>
			</>
		);
	} else {
		art = (
			<div className={css.tile}>
				<TvIcon />
				<span className={css.tagName}>{$L('Live TV')}</span>
			</div>
		);
	}

	return (
		<SpottableDiv
			className={`${css.card} ${isFocused ? css.focused : ''}`}
			onClick={handleClick}
			onFocus={handleFocus}
			spotlightId={spotlightId}
			onSpotlightLeft={onSpotlightLeft}
			onSpotlightRight={onSpotlightRight}
			style={{width: `${size.width}px`}}
		>
			<div className={css.frame} style={{height: `${size.height}px`}}>
				{art}
			</div>
			{isProgram && <div className={css.title}>{item.ChannelName || item.Name}</div>}
		</SpottableDiv>
	);
};

export default EsplayLiveCard;

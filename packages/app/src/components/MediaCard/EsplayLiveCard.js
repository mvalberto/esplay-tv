import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import $L from '@enact/i18n/$L';
import {useSettings} from '../../context/SettingsContext';
import {getPlatform} from '../../platform';
import {getImageUrl} from '../../utils/helpers';
import {isLiveTvProgram} from '../../utils/liveTvLibrary';
import {modernCardMetrics} from './modernCardLayout';

import css from './EsplayLiveCard.module.less';

const SpottableDiv = Spottable('div');

// EsPlay: the live TV cards of the home rows. A program airing now opens into a wide card with
// its picture, what it is and how far along; a channel tag shows its number in red over its name,
// and the live TV page its icon.

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

const TvIcon = () => (
	<svg className={css.tvIcon} viewBox="0 0 24 21" fill="none" stroke="#E71414" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<rect x="2" y="6" width="20" height="13" rx="2" />
		<path d="m7.5 2 4.5 4 4.5-4" />
		<path d="m10 10 5 2.5-5 2.5z" fill="#E71414" />
	</svg>
);

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
	const {settings} = useSettings();
	const platform = useMemo(() => getPlatform(), []);
	const focusTimeoutRef = useRef(null);
	const itemServerUrl = item?._serverUrl || serverUrl;
	const isProgram = isLiveTvProgram(item);

	useEffect(() => () => clearTimeout(focusTimeoutRef.current), []);

	const {imageHeight, expandedWidth, cardWidth} = modernCardMetrics({
		posterSize: settings.homeRowsPosterSize,
		platform,
		isSquareItem: false,
		isStatic: false
	});
	const expanded = isProgram && isFocused;

	// The program's own picture, then its channel's logo. A picture that fails hands over to the
	// next, and with neither the channel's name stands in.
	const pictures = useMemo(() => {
		if (!isProgram) return [];
		const list = [];
		if (item.ImageTags?.Primary) {
			list.push({kind: 'art', url: getImageUrl(itemServerUrl, item.Id, 'Primary', {tag: item.ImageTags.Primary, maxWidth: 800, quality: 80})});
		}
		if (item.ChannelPrimaryImageTag) {
			list.push({kind: 'logo', url: getImageUrl(itemServerUrl, item.ChannelId, 'Primary', {tag: item.ChannelPrimaryImageTag, maxWidth: 400, quality: 90})});
		}
		return list;
	}, [isProgram, item, itemServerUrl]);
	const [failed, setFailed] = useState(() => new Set());
	const picture = pictures.find((p) => !failed.has(p.url));
	const handleImageError = useCallback(() => {
		if (!picture) return;
		setFailed((prev) => new Set(prev).add(picture.url));
	}, [picture]);

	const now = isProgram ? airing(item) : null;

	const handleFocus = useCallback(() => {
		onFocused?.(item?.Id || null);
		clearTimeout(focusTimeoutRef.current);
		focusTimeoutRef.current = setTimeout(() => onFocusItem?.(item), 50);
	}, [item, onFocusItem, onFocused]);

	const handleClick = useCallback(() => onSelect?.(item), [item, onSelect]);

	const tagMatch = /^(\d+)\s+(.*)$/.exec(item?.Name || '');

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
						onError={handleImageError}
					/>
				) : (
					<div className={css.channelName}>{item.ChannelName || item.Name}</div>
				)}
				{expanded ? (
					<div className={css.showcase}>
						<div className={css.badges}>
							<span className={css.liveBadge}>{$L('LIVE')}</span>
							{item.ChannelName && <span className={css.channelChip}>{item.ChannelName}</span>}
						</div>
						<div className={css.showTitle}>{item.Name}</div>
						{now && (
							<div className={css.showTime}>
								{now.times} · {$L('{minutes} min left').replace('{minutes}', now.minutesLeft)}
							</div>
						)}
						{now && (
							<div className={css.showProgress}>
								<div className={css.progressFill} style={{width: `${now.percent}%`}} />
							</div>
						)}
						{item.Overview && <div className={css.overview}>{item.Overview}</div>}
					</div>
				) : (
					<>
						<span className={`${css.liveBadge} ${css.cornerBadge}`}>{$L('LIVE')}</span>
						{now && (
							<div className={css.edgeProgress}>
								<div className={css.progressFill} style={{width: `${now.percent}%`}} />
							</div>
						)}
					</>
				)}
			</>
		);
	} else if (item?.esplayTagId) {
		art = (
			<div className={css.tile}>
				{tagMatch && <div className={css.tagNumber}>{tagMatch[1]}</div>}
				<div className={css.tagName}>{tagMatch ? tagMatch[2] : item.Name}</div>
			</div>
		);
	} else {
		art = (
			<div className={css.tile}>
				<TvIcon />
				<div className={css.tagName}>{$L('Live TV')}</div>
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
			style={{width: `${expanded ? expandedWidth : cardWidth}px`}}
		>
			<div className={css.frame} style={{height: `${imageHeight}px`}}>
				{art}
			</div>
			{isProgram && <div className={css.title}>{item.ChannelName || item.Name}</div>}
		</SpottableDiv>
	);
};

export default EsplayLiveCard;

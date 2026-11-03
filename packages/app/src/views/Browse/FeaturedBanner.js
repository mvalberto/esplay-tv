import {useState, useEffect, useCallback, useRef, memo} from 'react';
import {isMdblistEnabled} from '../../services/mdblistApi';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';
import {getFeaturedBackdropUrl, formatDuration} from '../../utils/helpers';
import RatingsRow from '../../components/RatingsRow';
import {KEYS} from '../../utils/keys';
import useTrailerPreview from './useTrailerPreview';
import css from './Browse.module.less';
import esplay from './EsplayFeaturedBanner.module.less';
import {carouselIntervalMs} from '../../utils/carouselTiming';
import {useScreensaverActive} from '../../hooks/useScreensaverActive';
import {rem} from '../../utils/rootScale';

const FEATURED_GENRES_LIMIT = 3;
const PRELOAD_ADJACENT_SLIDES = 2;

// EsPlay: the bar is the showcase of the rows below at full size, as Prime Video's: the
// picture or trailer on the right fading into the dark, the text on the left and a progress
// mark per title. Left and Right still change title, OK opens it.
const ESPLAY_LOOK = true;
const NEW_FOR_DAYS = 30;

const isRecent = (item) => {
	const added = item.DateCreated ? Date.parse(item.DateCreated) : NaN;
	return !isNaN(added) && Date.now() - added < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
};

const kindOf = (item) => {
	if (item.Type === 'Movie') return $L('Movie');
	if (item.Type === 'Series') return $L('Series');
	return '';
};

const detailsOf = (item) => {
	const parts = [];
	if (item.ProductionYear) parts.push(String(item.ProductionYear));
	if (item.OfficialRating) parts.push(item.OfficialRating);
	if (item.CommunityRating) parts.push(`★ ${Number(item.CommunityRating).toFixed(1)}`);
	if (item.RunTimeTicks && item.Type !== 'Series') {
		const dur = formatDuration(item.RunTimeTicks);
		if (dur && dur !== '0m') parts.push(dur);
	}
	if (item.Genres?.length) parts.push(item.Genres.slice(0, FEATURED_GENRES_LIMIT).join(', '));
	return parts.join(' · ');
};

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

const FeaturedBanner = memo(({
	isVisible,
	rowPeek = 0,
	browseVisible = true,
	featuredItems,
	serverUrl,
	api,
	settings,
	settingsLoaded,
	getItemServerUrl,
	onSelectItem,
	onNavigateDown,
	onFeaturedFocus,
	uiPanelStyle,
	uiButtonStyle,
	onCurrentItemChange
}) => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [featuredFocused, setFeaturedFocused] = useState(false);
	const screensaverActive = useScreensaverActive();

	const preloadedImagesRef = useRef(new Set());
	const carouselIntervalRef = useRef(null);

	const currentFeatured = featuredItems[currentIndex];

	// A trailer outlives the carousel interval, so finishing one moves the hero on
	// itself rather than waiting out another full turn on a still backdrop.
	const handleTrailerEnded = useCallback(() => {
		if (featuredItems.length > 1) setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
	}, [featuredItems.length]);

	const {trailerActive, trailerHolding, trailerContainerRef} = useTrailerPreview({
		currentItem: currentFeatured,
		// The banner stays mounted behind the settings overlay so the hero keeps its
		// place, but the trailer has to stop or it plays on underneath it. A trailer hides
		// the navbar too, so it only plays while the bar itself has focus.
		isVisible: isVisible && browseVisible && featuredFocused,
		enabled: settingsLoaded && settings.featuredTrailerPreview,
		preferMuted: settings.featuredTrailerMuted,
		volume: settings.trailerVolume,
		showCaptions: settings.mediaBarTrailerCaptions,
		captionLanguage: settings.uiLanguage,
		api,
		getItemServerUrl,
		onEnded: handleTrailerEnded,
		// EsPlay's trailer stays in the picture's box, so the menu and the rows stay too.
		hidesChrome: featuredFocused && !ESPLAY_LOOK
	});

	useEffect(() => {
		if (featuredItems[currentIndex]) {
			onCurrentItemChange?.(featuredItems[currentIndex]);
		}
	}, [currentIndex, featuredItems, onCurrentItemChange]);

	useEffect(() => {
		setCurrentIndex(0);
		preloadedImagesRef.current.clear();
	}, [featuredItems]);

	useEffect(() => {
		if (featuredItems.length === 0) return;

		const preloadImage = (url) => {
			if (!url || preloadedImagesRef.current.has(url)) return;
			const img = new window.Image();
			img.src = url;
			preloadedImagesRef.current.add(url);
		};

		for (let offset = -PRELOAD_ADJACENT_SLIDES; offset <= PRELOAD_ADJACENT_SLIDES; offset++) {
			const index = (currentIndex + offset + featuredItems.length) % featuredItems.length;
			const item = featuredItems[index];
			if (item) {
				preloadImage(getFeaturedBackdropUrl(serverUrl, item, {maxWidth: 1920, quality: 85}));
				if (item.LogoUrl) {
					preloadImage(item.LogoUrl);
				}
			}
		}
	}, [currentIndex, featuredItems, serverUrl]);

	const startCarouselTimer = useCallback(() => {
		if (carouselIntervalRef.current) {
			clearInterval(carouselIntervalRef.current);
			carouselIntervalRef.current = null;
		}

		const carouselSpeed = carouselIntervalMs(
			settings.autoAdvance,
			settings.autoAdvanceInterval,
			settings.carouselSpeed
		);
		if (!isVisible || screensaverActive || featuredItems.length <= 1 || !featuredFocused || carouselSpeed <= 0 || trailerHolding) return;

		carouselIntervalRef.current = setInterval(() => {
			setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
		}, carouselSpeed);
	}, [isVisible, screensaverActive, featuredItems.length, featuredFocused, settings.autoAdvance, settings.autoAdvanceInterval, settings.carouselSpeed, trailerHolding]);

	useEffect(() => {
		const carouselSpeed = carouselIntervalMs(
			settings.autoAdvance,
			settings.autoAdvanceInterval,
			settings.carouselSpeed
		);
		if (!isVisible || screensaverActive || featuredItems.length <= 1 || !featuredFocused || carouselSpeed <= 0 || trailerHolding) return;
		startCarouselTimer();
		return () => {
			if (carouselIntervalRef.current) {
				clearInterval(carouselIntervalRef.current);
				carouselIntervalRef.current = null;
			}
		};
	}, [isVisible, screensaverActive, featuredItems.length, featuredFocused, settings.autoAdvance, settings.autoAdvanceInterval, settings.carouselSpeed, trailerHolding, startCarouselTimer]);

	const handleFeaturedPrev = useCallback(() => {
		if (featuredItems.length <= 1) return;
		setCurrentIndex((prev) =>
			prev === 0 ? featuredItems.length - 1 : prev - 1
		);
		startCarouselTimer();
	}, [featuredItems.length, startCarouselTimer]);

	const handleFeaturedNext = useCallback(() => {
		if (featuredItems.length <= 1) return;
		setCurrentIndex((prev) =>
			(prev + 1) % featuredItems.length
		);
		startCarouselTimer();
	}, [featuredItems.length, startCarouselTimer]);

	const handleFeaturedKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.LEFT) {
			e.preventDefault();
			e.stopPropagation();
			if (settings.navbarPosition === 'left') {
				Spotlight.focus('navbar');
			} else {
				handleFeaturedPrev();
			}
		} else if (e.keyCode === KEYS.RIGHT) {
			e.preventDefault();
			e.stopPropagation();
			handleFeaturedNext();
		} else if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			if (settings.navbarPosition !== 'left') {
				Spotlight.focus('navbar-home');
			}
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			setFeaturedFocused(false);
			onNavigateDown?.();
		}
	}, [handleFeaturedPrev, handleFeaturedNext, settings.navbarPosition, onNavigateDown]);

	const handleFeaturedClick = useCallback(() => {
		const item = featuredItems[currentIndex];
		if (item) onSelectItem(item);
	}, [featuredItems, currentIndex, onSelectItem]);

	const handleFeaturedFocus = useCallback(() => {
		setFeaturedFocused(true);
		onFeaturedFocus?.();
	}, [onFeaturedFocus]);

	const handleFeaturedBlur = useCallback(() => {
		setFeaturedFocused(false);
	}, []);

	const handleCarouselPrevClick = useCallback((e) => {
		e.stopPropagation();
		handleFeaturedPrev();
	}, [handleFeaturedPrev]);

	const handleCarouselNextClick = useCallback((e) => {
		e.stopPropagation();
		handleFeaturedNext();
	}, [handleFeaturedNext]);

	if (!isVisible || !currentFeatured) return null;

	if (ESPLAY_LOOK) {
		const carouselSpeed = carouselIntervalMs(settings.autoAdvance, settings.autoAdvanceInterval, settings.carouselSpeed);
		const advancing = featuredFocused && !screensaverActive && !trailerHolding && carouselSpeed > 0 && featuredItems.length > 1;
		const details = detailsOf(currentFeatured);
		const kind = kindOf(currentFeatured);
		return (
			<div className={css.featuredBanner}>
				<SpottableDiv
					className={css.featuredInner}
					spotlightId="featured-banner"
					onClick={handleFeaturedClick}
					onKeyDown={handleFeaturedKeyDown}
					onFocus={handleFeaturedFocus}
					onBlur={handleFeaturedBlur}
				>
					<div className={esplay.art}>
						<div className={`${esplay.pictureFade} ${trailerActive ? esplay.hidden : ''}`}>
							<img
								key={currentFeatured.Id}
								className={esplay.picture}
								src={getFeaturedBackdropUrl(getItemServerUrl(currentFeatured), currentFeatured, {maxWidth: 1920, quality: 85})}
								alt=""
							/>
						</div>
						<div className={esplay.video} ref={trailerContainerRef} />
						{trailerActive && <div className={`${esplay.videoShade} ${esplay.shadeLeft}`} />}
						{trailerActive && <div className={`${esplay.videoShade} ${esplay.shadeBottom}`} />}
					</div>
					<div className={`${esplay.text} ${settings.navbarPosition === 'left' ? esplay.sidebar : ''} ${trailerActive ? esplay.playing : ''}`}>
						<div className={esplay.badges}>
							{isRecent(currentFeatured) && <span className={esplay.newBadge}>{$L('NEW')}</span>}
							{kind && <span className={esplay.kind}>{kind}</span>}
						</div>
						{currentFeatured.LogoUrl ? (
							<img key={currentFeatured.LogoUrl} className={esplay.logo} src={currentFeatured.LogoUrl} alt={currentFeatured.Name} />
						) : (
							<div className={esplay.title}>{currentFeatured.Name}</div>
						)}
						{details && <div className={esplay.details}>{details}</div>}
						{!settings.hideHomeMediaDescription && currentFeatured.Overview && (
							<div className={esplay.overview}>{currentFeatured.Overview}</div>
						)}
						{featuredItems.length > 1 && (
							<div className={esplay.progress}>
								{featuredItems.map((item, idx) => (
									idx === currentIndex ? (
										<span key={idx} className={`${esplay.segment} ${esplay.current}`}>
											<span
												key={`${currentIndex}-${advancing}`}
												className={advancing ? esplay.filling : esplay.filled}
												style={advancing ? {animationDuration: `${carouselSpeed}ms`} : undefined}
											/>
										</span>
									) : <span key={idx} className={esplay.segment} />
								))}
								<span className={esplay.counter}>{currentIndex + 1} / {featuredItems.length}</span>
							</div>
						)}
					</div>
				</SpottableDiv>
			</div>
		);
	}

	// With the peek row out of the way the compact card drops back to where it sits
	// without a peek, so it covers less of the trailer.
	const contentDropped = rowPeek > 0 && trailerActive && featuredFocused;

	return (
		<div className={css.featuredBanner}>
			<SpottableDiv
				className={`${css.featuredInner} ${trailerActive ? css.trailerActive : ''}`}
				spotlightId="featured-banner"
				onClick={handleFeaturedClick}
				onKeyDown={handleFeaturedKeyDown}
				onFocus={handleFeaturedFocus}
				onBlur={handleFeaturedBlur}
			>
				<div className={css.featuredBackdrop}>
					<img
						src={getFeaturedBackdropUrl(getItemServerUrl(currentFeatured), currentFeatured, {maxWidth: 1920, quality: 85})}
						alt=""
					/>
				</div>

				<div className={css.trailerContainer} ref={trailerContainerRef} />

				{featuredItems.length > 1 && (
					<>
						{settings.navbarPosition !== 'left' && (
							<SpottableButton
								className={`${css.carouselNav} ${css.carouselNavLeft}`}
								onClick={handleCarouselPrevClick}
								style={uiButtonStyle}
							>
								<svg viewBox="0 0 24 24" width="32" height="32">
									<path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
								</svg>
							</SpottableButton>
						)}
						<SpottableButton
							className={`${css.carouselNav} ${css.carouselNavRight}`}
							onClick={handleCarouselNextClick}
							style={uiButtonStyle}
						>
							<svg viewBox="0 0 24 24" width="32" height="32">
								<path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
							</svg>
						</SpottableButton>
					</>
				)}

				<div className={css.featuredLogoContainer}>
					{currentFeatured.LogoUrl ? (
						<img
							src={currentFeatured.LogoUrl}
							alt={`${currentFeatured.Name} logo`}
						/>
					) : (
						<h1 className={css.featuredTitle}>{currentFeatured.Name}</h1>
					)}
				</div>

				<div
					className={`${css.featuredContent} ${contentDropped ? css.featuredContentDropped : ''}`}
					style={contentDropped ? {bottom: rem(52 - rowPeek)} : undefined}
				>
					<div className={css.featuredInfoBox} style={uiPanelStyle}>
						<div className={css.featuredMeta}>
							{currentFeatured.ProductionYear && (
								<span className={css.metaItem}>{currentFeatured.ProductionYear}</span>
							)}
							{currentFeatured.OfficialRating && (
								<span className={css.metaItem}><span className={css.metaBadge}>{currentFeatured.OfficialRating}</span></span>
							)}
							{(() => {
								if (!currentFeatured.RunTimeTicks || currentFeatured.Type === 'Series') return null;
								const dur = formatDuration(currentFeatured.RunTimeTicks);
								return dur && dur !== '0m' ? <span className={css.metaItem}>{dur}</span> : null;
							})()}
							{currentFeatured.Genres?.slice(0, FEATURED_GENRES_LIMIT).map((g, i) => (
								<span key={i} className={css.metaItem}>{g}</span>
							))}
						</div>
						<div className={css.featuredDetails}>
							<RatingsRow item={currentFeatured} serverUrl={getItemServerUrl(currentFeatured)} compact surface='mediaBar' pluginEnabled={isMdblistEnabled(settings, 'mediaBar')} />
							{!settings.hideHomeMediaDescription && (
								<p className={css.featuredOverview}>
									{currentFeatured.Overview || $L('No description available.')}
								</p>
							)}
						</div>
					</div>

				</div>

				{featuredItems.length > 1 && (
					<div className={css.featuredIndicators}>
						{featuredItems.map((_, idx) => (
							<div
								key={idx}
								className={`${css.indicatorDot} ${idx === currentIndex ? css.active : ''}`}
							/>
						))}
					</div>
				)}
			</SpottableDiv>
		</div>
	);
});

export default FeaturedBanner;

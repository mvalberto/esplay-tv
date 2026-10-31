import {useState, useEffect, useCallback, useRef} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';
import {useAuth} from '../../context/AuthContext';
import {getImageUrl} from '../../utils/helpers';
import LiveTV from '../LiveTV';
import {takePendingLiveTv} from '../../esplay/liveTvIntent';

import css from './EsplayLiveTV.module.less';

// EsPlay's live TV, like the Android app: the channel tags from Emby, what is on
// now and a row per tag, the guide one tab away, and a page per channel with its
// schedule, Play, Record and Favorite.

const SpottableDiv = Spottable('div');
const Section = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

const NUMBERED = /^(\d+)\s+(.+)$/;
const tagParts = (name) => {
	const match = NUMBERED.exec(name || '');
	return match ? {number: match[1], label: match[2]} : {number: null, label: name || ''};
};

const TagName = ({name, className}) => {
	const {number, label} = tagParts(name);
	return (
		<span className={className}>
			{number && <span className={css.tagNumber}>{number} </span>}
			{label}
		</span>
	);
};

const parseDate = (raw) => (raw ? new Date(raw) : null);
const twoDigits = (n) => (n < 10 ? '0' + n : '' + n);
const hm = (date) => twoDigits(date.getHours()) + ':' + twoDigits(date.getMinutes());
const timeRange = (start, end) => (start && end ? hm(start) + ' – ' + hm(end) : '');

const progressOf = (start, end) => {
	if (!start || !end || end <= start) return 0;
	return Math.max(0, Math.min(1, (Date.now() - start) / (end - start)));
};

const ProgressBar = ({value}) => (
	<div className={css.progress}>
		<div className={css.progressFill} style={{width: (value * 100) + '%'}} />
	</div>
);

const ChannelLogo = ({serverUrl, channelId, tag, name}) => {
	const [failed, setFailed] = useState(false);
	const onError = useCallback(() => setFailed(true), []);
	if (!tag || failed) return <div className={css.logoText}>{name}</div>;
	return (
		<img
			className={css.logo}
			src={getImageUrl(serverUrl, channelId, 'Primary', {maxHeight: 160, tag})}
			alt={name}
			onError={onError}
		/>
	);
};

const currentProgram = (channel) => {
	const program = channel.CurrentProgram;
	if (!program) return null;
	return {name: program.Name, start: parseDate(program.StartDate), end: parseDate(program.EndDate)};
};

/** A channel tile: its logo with progress, its name and what it airs. */
const ChannelCard = ({serverUrl, channel, onSelect, spotlightId}) => {
	const now = currentProgram(channel);
	const handleClick = useCallback(() => onSelect(channel), [channel, onSelect]);
	return (
		<SpottableDiv className={css.channelCard} onClick={handleClick} data-spotlight-id={spotlightId}>
			<div className={css.channelArt}>
				<ChannelLogo serverUrl={serverUrl} channelId={channel.Id} tag={channel.ImageTags && channel.ImageTags.Primary} name={channel.Name} />
				{now && <ProgressBar value={progressOf(now.start, now.end)} />}
			</div>
			<div className={css.cardTitle}>{channel.Name}</div>
			<div className={css.cardSub}>{now ? now.name : $L('No guide information')}</div>
		</SpottableDiv>
	);
};

/** A program airing now as a poster, the channel's logo when it has none. */
const OnNowCard = ({serverUrl, program, onSelect}) => {
	const start = parseDate(program.StartDate);
	const end = parseDate(program.EndDate);
	const handleClick = useCallback(() => onSelect(program.ChannelId), [program, onSelect]);
	const poster = program.ImageTags && program.ImageTags.Primary;
	return (
		<SpottableDiv className={css.posterCard} onClick={handleClick}>
			<div className={css.posterArt}>
				{poster ? (
					<img className={css.posterImage} src={getImageUrl(serverUrl, program.Id, 'Primary', {maxWidth: 360, tag: poster})} alt="" />
				) : (
					<ChannelLogo serverUrl={serverUrl} channelId={program.ChannelId} tag={program.ChannelPrimaryImageTag} name={program.ChannelName || ''} />
				)}
				<span className={css.liveBadge}>{$L('LIVE')}</span>
				<ProgressBar value={progressOf(start, end)} />
			</div>
			<div className={css.cardTitle}>{program.Name}</div>
			<div className={css.cardSub}>{[program.ChannelName, timeRange(start, end)].filter(Boolean).join(' · ')}</div>
		</SpottableDiv>
	);
};

const TagRow = ({serverUrl, tag, loadChannels, onSelectChannel, onOpenTag}) => {
	const [channels, setChannels] = useState(null);
	useEffect(() => {
		let alive = true;
		loadChannels(tag.Id).then((list) => {
			if (alive) setChannels(list);
		});
		return () => {
			alive = false;
		};
	}, [loadChannels, tag.Id]);
	const handleOpen = useCallback(() => onOpenTag(tag), [onOpenTag, tag]);
	const handleSelect = useCallback((channel) => onSelectChannel(channel, tag.Id), [onSelectChannel, tag.Id]);
	if (!channels || channels.length === 0) return null;
	return (
		<Section className={css.row}>
			<div className={css.rowHeader}>
				<TagName name={tag.Name} className={css.rowTitle} />
				<SpottableDiv className={css.rowAction} onClick={handleOpen}>{$L('See channels')}</SpottableDiv>
			</div>
			<div className={css.rowScroller}>
				{channels.map((channel) => (
					<ChannelCard key={channel.Id} serverUrl={serverUrl} channel={channel} onSelect={handleSelect} />
				))}
			</div>
		</Section>
	);
};

const TagChip = ({tag, onOpen}) => {
	const handleClick = useCallback(() => onOpen(tag), [onOpen, tag]);
	return (
		<SpottableDiv className={css.chip} onClick={handleClick}>
			<TagName name={tag.Name} />
		</SpottableDiv>
	);
};

const RailItem = ({tag, selected, onSelect}) => {
	const handleSelect = useCallback(() => onSelect(tag), [onSelect, tag]);
	return (
		<SpottableDiv
			className={selected ? css.railItemSelected : css.railItem}
			onFocus={handleSelect}
			onClick={handleSelect}
		>
			<TagName name={tag.Name} />
		</SpottableDiv>
	);
};

/** One channel: logo, Play, Record and Favorite, then the next day's programs. */
const ChannelPage = ({api, serverUrl, channel, onPlay}) => {
	const [programs, setPrograms] = useState(null);
	const [favorite, setFavorite] = useState(Boolean(channel.UserData && channel.UserData.IsFavorite));
	const [message, setMessage] = useState(null);

	const load = useCallback(() => {
		api.getLiveTvChannelSchedule(channel.Id).then((result) => {
			const items = (result && result.Items) || [];
			items.sort((a, b) => (a.StartDate || '').localeCompare(b.StartDate || ''));
			setPrograms(items);
		}, () => setPrograms([]));
	}, [api, channel.Id]);

	useEffect(() => {
		load();
		setTimeout(() => Spotlight.focus('esplay-channel-play'), 50);
	}, [load]);

	const now = Date.now();
	const current = (programs || []).find((p) => parseDate(p.StartDate) <= now && parseDate(p.EndDate) > now);
	const recording = Boolean(current && current.TimerId);

	const toggleRecording = useCallback(async (program) => {
		try {
			if (program.TimerId) {
				await api.cancelLiveTvTimer(program.TimerId);
				setMessage($L('Recording cancelled'));
			} else {
				await api.createLiveTvTimer(program.Id);
				setMessage($L('Recording scheduled'));
			}
			load();
		} catch {
			setMessage($L('That did not work. Try again.'));
		}
	}, [api, load]);

	const handleRecord = useCallback(() => current && toggleRecording(current), [current, toggleRecording]);
	const handleFavorite = useCallback(async () => {
		try {
			await api.setFavorite(channel.Id, !favorite);
			setFavorite(!favorite);
		} catch {
			setMessage($L('That did not work. Try again.'));
		}
	}, [api, channel.Id, favorite]);

	return (
		<div className={css.channelPage}>
			<div className={css.channelHeader}>
				<div className={css.channelHeaderLogo}>
					<ChannelLogo serverUrl={serverUrl} channelId={channel.Id} tag={channel.ImageTags && channel.ImageTags.Primary} name={channel.Name} />
				</div>
				<div className={css.channelHeaderInfo}>
					<h1 className={css.channelName}>{channel.Name}</h1>
					<Section className={css.channelButtons}>
						<SpottableDiv className={css.primaryButton} onClick={onPlay} data-spotlight-id="esplay-channel-play">▶ {$L('Play')}</SpottableDiv>
						{current && (
							<SpottableDiv className={css.secondaryButton} onClick={handleRecord}>
								<span className={recording ? css.recordOn : css.recordOff}>●</span> {recording ? $L('Cancel recording') : $L('Create recording')}
							</SpottableDiv>
						)}
						<SpottableDiv className={css.secondaryButton} onClick={handleFavorite}>
							<span className={favorite ? css.recordOn : css.recordOff}>{favorite ? '♥' : '♡'}</span> {$L('Favorite')}
						</SpottableDiv>
					</Section>
					{message && <div className={css.message}>{message}</div>}
				</div>
			</div>
			<Section className={css.schedule}>
				{programs && programs.length === 0 && <div className={css.empty}>{$L('No upcoming programs for this channel.')}</div>}
				{(programs || []).map((program) => (
					<ProgramRow
						key={program.Id}
						serverUrl={serverUrl}
						program={program}
						channel={channel}
						isCurrent={program === current}
						onPlay={onPlay}
						onRecord={toggleRecording}
					/>
				))}
			</Section>
		</div>
	);
};

const ProgramRow = ({serverUrl, program, channel, isCurrent, onPlay, onRecord}) => {
	const start = parseDate(program.StartDate);
	const end = parseDate(program.EndDate);
	const handleClick = useCallback(() => (isCurrent ? onPlay() : onRecord(program)), [isCurrent, onPlay, onRecord, program]);
	const poster = program.ImageTags && program.ImageTags.Primary;
	const facts = [
		program.ProductionYear,
		program.OfficialRating,
		program.CommunityRating ? '★' + Number(program.CommunityRating).toFixed(1) + '/10' : null
	].filter(Boolean).join(' | ');
	let day = '';
	try {
		day = start ? start.toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'short'}) : '';
	} catch {
		day = '';
	}
	const genres = (program.Genres || []).join(', ');
	return (
		<SpottableDiv className={css.programRow} onClick={handleClick}>
			<div className={css.programArt}>
				{poster ? (
					<img className={css.posterImage} src={getImageUrl(serverUrl, program.Id, 'Primary', {maxWidth: 300, tag: poster})} alt="" />
				) : (
					<ChannelLogo serverUrl={serverUrl} channelId={channel.Id} tag={channel.ImageTags && channel.ImageTags.Primary} name={channel.Name} />
				)}
				{isCurrent && <ProgressBar value={progressOf(start, end)} />}
			</div>
			<div className={css.programInfo}>
				<div className={css.programTitle}>
					{program.TimerId && <span className={css.recordOn}>● </span>}
					{[program.Name, program.EpisodeTitle].filter(Boolean).join(' · ')}
				</div>
				{facts && <div className={css.cardSub}>{facts}</div>}
				<div className={isCurrent ? css.programWhenNow : css.cardSub}>{[day, timeRange(start, end)].filter(Boolean).join(', ')}</div>
				<div className={css.programOverview}>{[genres && '(' + genres + ')', program.Overview].filter(Boolean).join(' ')}</div>
				{!isCurrent && <div className={css.programHint}>{program.TimerId ? $L('OK cancels the recording') : $L('OK records this program')}</div>}
			</div>
		</SpottableDiv>
	);
};

const EsplayLiveTV = ({onPlayChannel, onRecordings, backHandlerRef}) => {
	const {api, serverUrl} = useAuth();
	const [section, setSection] = useState('home');
	const [tags, setTags] = useState(null);
	const [onNow, setOnNow] = useState([]);
	const [selectedTag, setSelectedTag] = useState(null);
	const [channelPage, setChannelPage] = useState(null);
	const channelCache = useRef({});
	// Home, search or favorites may have sent us to a tag or a channel.
	const intent = useRef(takePendingLiveTv());
	const guideBackRef = useRef(null);
	const lastSection = useRef('home');

	const loadChannels = useCallback((tagId) => {
		if (!channelCache.current[tagId]) {
			channelCache.current[tagId] = api.getLiveTvChannelsWithTag(tagId).then(
				(result) => (result && result.Items) || [],
				() => {
					delete channelCache.current[tagId];
					return [];
				}
			);
		}
		return channelCache.current[tagId];
	}, [api]);

	useEffect(() => {
		api.getLiveTvChannelTags().then((result) => {
			const items = (result && (result.Items || result)) || [];
			setTags(Array.isArray(items) ? items.filter((t) => t && t.Id) : []);
		}, () => setTags([]));
		api.getLiveTvAiringWithChannels(12).then((result) => {
			setOnNow(((result && result.Items) || []).filter((p) => p.ChannelId));
		}, () => setOnNow([]));
		setTimeout(() => Spotlight.focus('esplay-tab-home'), 50);
	}, [api]);

	useEffect(() => {
		if (section === 'tags' && !selectedTag && tags && tags.length) setSelectedTag(tags[0]);
	}, [section, selectedTag, tags]);

	useEffect(() => {
		const wanted = intent.current;
		if (!wanted) return;
		if (wanted.channel) {
			intent.current = null;
			setChannelPage({channel: wanted.channel, lineup: [wanted.channel]});
		} else if (wanted.tagId && tags) {
			intent.current = null;
			const tag = tags.find((t) => t.Id === wanted.tagId);
			if (tag) {
				setSelectedTag(tag);
				setSection('tags');
			}
		}
	}, [tags]);

	const openChannel = useCallback((channel, lineup) => {
		lastSection.current = section;
		setChannelPage({channel, lineup: lineup || [channel]});
	}, [section]);

	// A program from "On now" only knows its channel id: find it in the loaded tags.
	const openChannelById = useCallback(async (channelId) => {
		const tagIds = Object.keys(channelCache.current);
		for (const id of tagIds) {
			const list = await channelCache.current[id];
			const found = list.find((c) => c.Id === channelId);
			if (found) {
				openChannel(found, list);
				return;
			}
		}
		try {
			const item = await api.getItem(channelId);
			if (item) openChannel(item, [item]);
		} catch {
			// The program's channel could not be loaded.
		}
	}, [api, openChannel]);

	const openChannelInTag = useCallback((channel, tagId) => {
		loadChannels(tagId).then((list) => openChannel(channel, list));
	}, [loadChannels, openChannel]);

	const openTag = useCallback((tag) => {
		setSelectedTag(tag);
		setSection('tags');
	}, []);

	const playChannelPage = useCallback(() => {
		if (!channelPage) return;
		onPlayChannel(channelPage.channel, channelPage.lineup);
	}, [channelPage, onPlayChannel]);

	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (channelPage) {
				setChannelPage(null);
				return true;
			}
			if (section === 'guide') {
				if (guideBackRef.current && guideBackRef.current()) return true;
				setSection('home');
				setTimeout(() => Spotlight.focus('esplay-tab-guide'), 50);
				return true;
			}
			if (section === 'tags') {
				setSection('home');
				setTimeout(() => Spotlight.focus('esplay-tab-tags'), 50);
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, channelPage, section]);

	if (channelPage) {
		return (
			<div className={css.page}>
				<ChannelPage api={api} serverUrl={serverUrl} channel={channelPage.channel} onPlay={playChannelPage} />
			</div>
		);
	}

	if (section === 'guide') {
		return <LiveTV onPlayChannel={onPlayChannel} onRecordings={onRecordings} backHandlerRef={guideBackRef} />;
	}

	const tabs = [
		{id: 'home', label: $L('Home'), onClick: () => setSection('home')},
		...(tags && tags.length ? [{id: 'tags', label: $L('Tags'), onClick: () => setSection('tags')}] : []),
		{id: 'guide', label: $L('Guide'), onClick: () => setSection('guide')},
		{id: 'recordings', label: $L('Recordings'), onClick: onRecordings}
	];

	return (
		<div className={css.page}>
			<div className={css.header}>
				<h1 className={css.title}>{$L('Live TV')}</h1>
				<Section className={css.tabs}>
					{tabs.map((tab) => (
						<SpottableDiv
							key={tab.id}
							data-spotlight-id={'esplay-tab-' + tab.id}
							className={section === tab.id ? css.tabSelected : css.tab}
							onClick={tab.onClick}
						>
							{tab.label}
						</SpottableDiv>
					))}
				</Section>
			</div>

			{section === 'home' && (
				<div className={css.scroll}>
					{tags && tags.length > 0 && (
						<Section className={css.row}>
							<div className={css.rowHeader}>
								<span className={css.rowTitle}>{$L('Tags')}</span>
							</div>
							<div className={css.rowScroller}>
								{tags.map((tag) => (
									<TagChip key={tag.Id} tag={tag} onOpen={openTag} />
								))}
							</div>
						</Section>
					)}
					{onNow.length > 0 && (
						<Section className={css.row}>
							<div className={css.rowHeader}>
								<span className={css.rowTitle}>{$L('On now')}</span>
							</div>
							<div className={css.rowScroller}>
								{onNow.map((program) => (
									<OnNowCard key={program.Id} serverUrl={serverUrl} program={program} onSelect={openChannelById} />
								))}
							</div>
						</Section>
					)}
					{(tags || []).map((tag) => (
						<TagRow
							key={tag.Id}
							serverUrl={serverUrl}
							tag={tag}
							loadChannels={loadChannels}
							onSelectChannel={openChannelInTag}
							onOpenTag={openTag}
						/>
					))}
					{tags && tags.length === 0 && onNow.length === 0 && (
						<div className={css.empty}>{$L('This server has no channel tags yet.')}</div>
					)}
				</div>
			)}

			{section === 'tags' && (
				<TagsView
					serverUrl={serverUrl}
					tags={tags || []}
					selected={selectedTag}
					onSelectTag={setSelectedTag}
					loadChannels={loadChannels}
					onSelectChannel={openChannel}
				/>
			)}
		</div>
	);
};

/** The tags down the left; the focused tag's channels in a grid on the right. */
const TagsView = ({serverUrl, tags, selected, onSelectTag, loadChannels, onSelectChannel}) => {
	const [channels, setChannels] = useState(null);
	const handleSelectChannel = useCallback((channel) => onSelectChannel(channel, channels), [channels, onSelectChannel]);
	useEffect(() => {
		if (!selected) return undefined;
		let alive = true;
		setChannels(null);
		loadChannels(selected.Id).then((list) => {
			if (alive) setChannels(list);
		});
		return () => {
			alive = false;
		};
	}, [loadChannels, selected]);

	return (
		<div className={css.tagsView}>
			<Section className={css.rail}>
				{tags.map((tag) => (
					<RailItem
						key={tag.Id}
						tag={tag}
						selected={Boolean(selected && selected.Id === tag.Id)}
						onSelect={onSelectTag}
					/>
				))}
			</Section>
			<div className={css.tagChannels}>
				{selected && <TagName name={selected.Name} className={css.tagHeading} />}
				<Section className={css.grid}>
					{channels && channels.length === 0 && <div className={css.empty}>{$L('This tag has no channels.')}</div>}
					{(channels || []).map((channel) => (
						<ChannelCard
							key={channel.Id}
							serverUrl={serverUrl}
							channel={channel}
							onSelect={handleSelectChannel}
						/>
					))}
				</Section>
			</div>
		</div>
	);
};

export default EsplayLiveTV;

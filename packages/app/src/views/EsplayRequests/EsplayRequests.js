// EsPlay requests: look a title up on TMDB, ask for it (or join someone else's request), and
// follow your requests and reports. The panel keeps them; see services/esplayRequests.js.
import {useCallback, useEffect, useRef, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import $L from '@enact/i18n/$L';

import SpottableInput from '../../components/SpottableInput/SpottableInput';
import {errorText, getTitle, myRequests, requestTitle, searchTitles} from '../../services/esplayRequests';

import css from './EsplayRequests.module.less';

const Section = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');

const STATUS = {
	pendiente: () => ({label: $L('Pending'), cls: css.badgeGrey}),
	en_curso: () => ({label: $L('In progress'), cls: css.badgeBlue}),
	hecha: () => ({label: $L('Fulfilled'), cls: css.badgeGreen}),
	rechazada: () => ({label: $L('Rejected'), cls: css.badgeRed})
};

const kindText = (mediaType) => (mediaType === 'tv' ? $L('Series') : $L('Movie'));
const interested = (n) => (n === 1 ? $L('1 interested') : $L('{n} interested').replace('{n}', n));

const Poster = ({src, title, className}) => (
	<div className={className || css.poster}>
		{src ? <img className={css.posterImg} src={src} alt="" /> : <span className={css.posterText}>{title}</span>}
	</div>
);

const ResultCard = ({item, onOpen}) => {
	const handle = useCallback(() => onOpen(item), [item, onOpen]);
	return (
		<SpottableDiv className={css.card} onClick={handle}>
			<Poster src={item.poster} title={item.title} />
			<div className={css.cardTitle}>{item.title}</div>
			<div className={css.cardSub}>{kindText(item.media_type)}{item.year ? ' · ' + item.year : ''}</div>
			{item.library_item_id ? (
				<span className={css.badgeGreen}>{$L('On EsPlay')}</span>
			) : item.request ? (
				<span className={css.badgeRed}>
					{$L('Asked for') + ' · ' + interested(item.request.followers)}
				</span>
			) : null}
		</SpottableDiv>
	);
};

const MineRow = ({row, onOpen}) => {
	const handle = useCallback(() => onOpen(row), [row, onOpen]);
	const st = (STATUS[row.status] || STATUS.pendiente)();
	const report = row.kind === 'reporte';
	const statusLabel = report && row.status === 'hecha' ? $L('Solved') : st.label;
	return (
		<SpottableDiv className={css.mineRow} onClick={handle}>
			{report ? <div className={css.mineIcon}>!</div> : <Poster src={row.poster} title={row.title} className={css.minePoster} />}
			<div className={css.mineText}>
				<div className={css.mineTitle}>{report ? $L('Report') + ' · ' + row.title : row.title}</div>
				<div className={css.mineSub}>
					{report ? (row.note || '') : kindText(row.media_type) + (row.year ? ' · ' + row.year : '')}
					{' · '}{row.mine ? $L('Requested on {date}').replace('{date}', row.created) : $L('You joined')}
					{!report && row.followers > 1 ? ' · ' + interested(row.followers) : ''}
				</div>
				{row.admin_note && <div className={css.mineNote}>{$L('Reply')}: «{row.admin_note}»</div>}
			</div>
			<span className={st.cls}>{statusLabel}</span>
		</SpottableDiv>
	);
};

const EsplayRequests = ({onSelectItem, backHandlerRef}) => {
	const [tab, setTab] = useState('search');
	const [query, setQuery] = useState('');
	const [results, setResults] = useState(null);
	const [remaining, setRemaining] = useState(null);
	const [max, setMax] = useState(2);
	const [error, setError] = useState(null);
	const [searching, setSearching] = useState(false);
	const [detail, setDetail] = useState(null);
	const [mine, setMine] = useState(null);
	const lastFocus = useRef(null);
	const searchSeq = useRef(0);

	// Typing searches after a short pause.
	useEffect(() => {
		const q = query.trim();
		if (q.length < 2) {
			setResults(null);
			return undefined;
		}
		const seq = ++searchSeq.current;
		const t = setTimeout(async () => {
			setSearching(true);
			try {
				const data = await searchTitles(q);
				if (seq !== searchSeq.current) return;
				setResults(data.results || []);
				setRemaining(data.remaining);
				setMax(data.max || 2);
				setError(null);
			} catch (err) {
				if (seq === searchSeq.current) setError(errorText(err, $L));
			} finally {
				if (seq === searchSeq.current) setSearching(false);
			}
		}, 600);
		return () => clearTimeout(t);
	}, [query]);

	const loadMine = useCallback(async () => {
		try {
			const data = await myRequests();
			setMine(data.items || []);
			setRemaining(data.remaining);
			setMax(data.max || 2);
			setError(null);
		} catch (err) {
			setMine([]);
			setError(errorText(err, $L));
		}
	}, []);

	useEffect(() => {
		if (tab === 'mine') loadMine();
	}, [tab, loadMine]);

	useEffect(() => {
		const t = setTimeout(() => Spotlight.focus('esplay-requests-input'), 150);
		return () => clearTimeout(t);
	}, []);

	const openTitle = useCallback(async (item) => {
		lastFocus.current = document.activeElement;
		setDetail({item, loading: true});
		try {
			const data = await getTitle(item.media_type, item.id);
			setDetail({item: data.item || item, data, loading: false});
			setRemaining(data.remaining);
		} catch (err) {
			setDetail({item, loading: false, message: errorText(err, $L), failed: true});
		}
	}, []);

	const openMine = useCallback((row) => {
		if (row.kind === 'reporte' || !row.tmdb_id) return;
		openTitle({id: row.tmdb_id, media_type: row.media_type, title: row.title, year: row.year, poster: row.poster});
	}, [openTitle]);

	const closeDetail = useCallback(() => {
		setDetail(null);
		setTimeout(() => {
			if (lastFocus.current && document.body.contains(lastFocus.current)) Spotlight.focus(lastFocus.current);
			else Spotlight.focus('esplay-requests-input');
		}, 50);
	}, []);

	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (detail) {
				closeDetail();
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, detail, closeDetail]);

	useEffect(() => {
		if (detail && !detail.loading) {
			const t = setTimeout(() => Spotlight.focus('esplay-request-primary'), 80);
			return () => clearTimeout(t);
		}
	}, [detail]);

	const submit = useCallback(async (acceptRisk) => {
		if (!detail || detail.sending) return;
		const {item} = detail;
		setDetail((d) => ({...d, sending: true, message: null}));
		try {
			const res = await requestTitle(item.media_type, item.id, '', acceptRisk);
			setRemaining(res.remaining);
			const data = await getTitle(item.media_type, item.id).catch(() => detail.data);
			setDetail({item, data, loading: false, done: true,
				message: res.result === 'followed'
					? $L('Done: we will let you know in My requests when it is ready.')
					: $L('Requested. You can follow it in My requests.')});
			setResults((list) => list && list.map((r) => (r.id === item.id && r.media_type === item.media_type
				? {...r, request: data && data.request} : r)));
		} catch (err) {
			setDetail((d) => ({...d, sending: false, message: errorText(err, $L),
				needsRisk: err.message === 'requiere_aceptar_riesgo'}));
		}
	}, [detail]);

	const handleRequest = useCallback(() => submit(false), [submit]);
	const handleRequestAnyway = useCallback(() => submit(true), [submit]);
	const handleWatch = useCallback(() => {
		const id = detail?.data?.library?.item_id;
		if (id) onSelectItem({Id: id, Type: detail.item.media_type === 'tv' ? 'Series' : 'Movie', Name: detail.item.title});
	}, [detail, onSelectItem]);

	const handleQuery = useCallback((ev) => setQuery(ev.target.value), []);
	const showSearch = useCallback(() => setTab('search'), []);
	const showMine = useCallback(() => setTab('mine'), []);

	const quota = remaining == null ? null : (
		<div className={css.quota}>
			{$L('You have {n} of {max} requests left this week').replace('{n}', remaining).replace('{max}', max)}
		</div>
	);

	if (detail) {
		const {item, data, loading} = detail;
		const lib = data && data.library;
		const req = data && data.request;
		const es = data && data.es;
		let primary = null;
		if (lib && lib.found) {
			primary = <SpottableButton spotlightId="esplay-request-primary" className={css.primary} onClick={handleWatch}>{$L('Watch on EsPlay')}</SpottableButton>;
		} else if (data && data.following) {
			primary = <SpottableButton spotlightId="esplay-request-primary" className={css.secondary} disabled>{$L('You follow it')}</SpottableButton>;
		} else if (detail.needsRisk) {
			primary = <SpottableButton spotlightId="esplay-request-primary" className={css.primary} onClick={handleRequestAnyway}>{$L('Request anyway')}</SpottableButton>;
		} else if (data) {
			primary = (
				<SpottableButton spotlightId="esplay-request-primary" className={css.primary} onClick={handleRequest} disabled={detail.sending}>
					{req ? $L('I am interested') : $L('Request')}
				</SpottableButton>
			);
		}
		return (
			<div className={css.page}>
				<div className={css.detail}>
					<Poster src={item.poster} title={item.title} className={css.detailPoster} />
					<Section className={css.detailText}>
						<div className={css.detailKind}>{kindText(item.media_type)}{item.year ? ' · ' + item.year : ''}</div>
						<h1 className={css.detailTitle}>{item.title}</h1>
						{item.overview && <p className={css.detailOverview}>{item.overview}</p>}
						{loading && <div className={css.muted}>{$L('Loading...')}</div>}
						{es && es.length > 0 && <div className={css.muted}>{$L('In Spain on: {list}').replace('{list}', es.join(', '))}</div>}
						{es && es.length === 0 && !(lib && lib.found) && (
							<div className={css.warning}>{$L('It is not on any platform in Spain: it may not be possible to get it.')}</div>
						)}
						<div className={css.actions}>
							{primary}
							<SpottableButton className={css.secondary} onClick={closeDetail}>{$L('Back')}</SpottableButton>
						</div>
						{req && !(lib && lib.found) && (
							<div className={css.infoBox}>
								<strong>{$L('Already requested')}</strong>
								{' · '}{(STATUS[req.status] || STATUS.pendiente)().label}
								{' · '}{interested(req.followers)}
								{!data.following && <div className={css.muted}>{$L('"I am interested" does not use up your requests.')}</div>}
							</div>
						)}
						{detail.message && <div className={detail.done ? css.ok : css.error}>{detail.message}</div>}
						{data && !req && !(lib && lib.found) && quota}
					</Section>
				</div>
			</div>
		);
	}

	return (
		<div className={css.page}>
			<div className={css.header}>
				<div>
					<h1 className={css.title}>{$L('Requests')}</h1>
					<Section className={css.tabs}>
						<SpottableButton className={tab === 'search' ? css.tabSelected : css.tab} onClick={showSearch}>{$L('Request a title')}</SpottableButton>
						<SpottableButton className={tab === 'mine' ? css.tabSelected : css.tab} onClick={showMine}>{$L('My requests')}</SpottableButton>
					</Section>
				</div>
				{quota}
			</div>
			{tab === 'search' && (
				<>
					<SpottableInput
						spotlightId="esplay-requests-input"
						className={css.search}
						type="text"
						purpose="search"
						placeholder={$L('Search for a movie or series')}
						value={query}
						onChange={handleQuery}
						maxLength={100}
					/>
					<div className={css.scroll}>
						{searching && !results && <div className={css.muted}>{$L('Searching...')}</div>}
						{error && <div className={css.error}>{error}</div>}
						{results && results.length === 0 && <div className={css.muted}>{$L('No results')}</div>}
						{!results && !searching && !error && (
							<div className={css.muted}>{$L('Type the title you want. If it is not on EsPlay you can request it.')}</div>
						)}
						<Section className={css.grid}>
							{(results || []).map((item) => (
								<ResultCard key={item.media_type + item.id} item={item} onOpen={openTitle} />
							))}
						</Section>
					</div>
				</>
			)}
			{tab === 'mine' && (
				<Section className={css.scroll}>
					{error && <div className={css.error}>{error}</div>}
					{mine === null && <div className={css.muted}>{$L('Loading...')}</div>}
					{mine && mine.length === 0 && <div className={css.muted}>{$L('You have no requests or reports yet.')}</div>}
					{(mine || []).map((row) => <MineRow key={row.id} row={row} onOpen={openMine} />)}
				</Section>
			)}
		</div>
	);
};

export default EsplayRequests;

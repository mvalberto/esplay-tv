// EsPlay: report a problem with a movie, series or episode to the panel. Mounted once by the app
// and opened from any detail screen through openReportDialog.
import {useCallback, useEffect, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import $L from '@enact/i18n/$L';

import {isBackKey} from '../../utils/keys';
import SpottableInput from '../SpottableInput/SpottableInput';
import {isTvKeyboardVisible} from '../TVKeyboard/keyboardBus';
import {errorText, reportItem, REPORT_CATEGORIES} from '../../services/esplayRequests';

import css from './EsplayReportDialog.module.less';

const DialogContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	restrict: 'self-only',
	leaveFor: {left: '', right: '', up: '', down: ''}
}, 'div');

const SpottableButton = Spottable('button');

const CATEGORY_TEXT = {
	audio: () => [$L('Audio'), $L('No sound, out of sync, wrong language')],
	imagen: () => [$L('Picture'), $L('Wrong artwork or video, cuts')],
	subtitulos: () => [$L('Subtitles'), $L('Missing, out of sync, wrong language')],
	calidad: () => [$L('Quality'), $L('Looks bad, stutters')]
};

const titleOf = (item) => {
	if (!item) return '';
	if (item.Type === 'Episode') {
		const ep = 'T' + (item.ParentIndexNumber ?? '?') + 'E' + (item.IndexNumber ?? '?');
		return (item.SeriesName ? item.SeriesName + ' · ' : '') + ep + ' ' + (item.Name || '');
	}
	return (item.Name || '') + (item.ProductionYear ? ' (' + item.ProductionYear + ')' : '');
};

const EsplayReportDialog = () => {
	const [item, setItem] = useState(null);
	const [category, setCategory] = useState(null);
	const [note, setNote] = useState('');
	const [sending, setSending] = useState(false);
	const [message, setMessage] = useState(null);
	const [done, setDone] = useState(false);

	const close = useCallback(() => setItem(null), []);

	useEffect(() => {
		const open = (e) => {
			setItem(e.detail?.item || null);
			setCategory(null);
			setNote('');
			setSending(false);
			setMessage(null);
			setDone(false);
		};
		window.addEventListener('esplay:report', open);
		return () => window.removeEventListener('esplay:report', open);
	}, []);

	useEffect(() => {
		if (!item) return undefined;
		const t = setTimeout(() => Spotlight.focus('esplay-report-dialog'), 100);
		const handleKey = (e) => {
			if (isTvKeyboardVisible()) return;
			if (isBackKey(e)) {
				e.preventDefault();
				e.stopPropagation();
				close();
			}
		};
		window.addEventListener('keydown', handleKey, true);
		return () => {
			clearTimeout(t);
			window.removeEventListener('keydown', handleKey, true);
		};
	}, [item, close]);

	useEffect(() => {
		if (done) {
			const t = setTimeout(() => Spotlight.focus('esplay-report-close'), 50);
			return () => clearTimeout(t);
		}
	}, [done]);

	const pick = useCallback((ev) => setCategory(ev.currentTarget.dataset.category), []);
	const handleNote = useCallback((ev) => setNote(ev.target.value), []);

	const send = useCallback(async () => {
		if (!item || !category || sending) return;
		setSending(true);
		setMessage(null);
		try {
			await reportItem(item.Id, category, note.trim());
			setDone(true);
			setMessage($L('Thanks. We will look into it; you can follow it in Requests.'));
		} catch (err) {
			setMessage(errorText(err, $L));
		} finally {
			setSending(false);
		}
	}, [item, category, note, sending]);

	if (!item) return null;

	return (
		<div className={css.overlay}>
			<DialogContainer className={css.dialog} spotlightId="esplay-report-dialog">
				<h2 className={css.title}>{$L('Report a problem')}</h2>
				<div className={css.subtitle}>{titleOf(item)}</div>
				{!done && (
					<>
						<div className={css.question}>{$L('What is wrong?')}</div>
						<div className={css.grid}>
							{REPORT_CATEGORIES.map((id, i) => {
								const [label, hint] = CATEGORY_TEXT[id]();
								return (
									<SpottableButton
										key={id}
										data-category={id}
										spotlightId={i === 0 ? 'esplay-report-first' : undefined}
										className={category === id ? css.categorySelected : css.category}
										onClick={pick}
									>
										<span className={css.categoryLabel}>{label}</span>
										<span className={css.categoryHint}>{hint}</span>
									</SpottableButton>
								);
							})}
						</div>
						<SpottableInput
							className={css.input}
							type="text"
							placeholder={$L('Details (optional)')}
							value={note}
							onChange={handleNote}
							maxLength={300}
						/>
					</>
				)}
				{message && <div className={done ? css.ok : css.error}>{message}</div>}
				<div className={css.buttons}>
					<span className={css.limit}>{done ? '' : $L('You can send 5 reports a day')}</span>
					<SpottableButton className={css.button} onClick={close} spotlightId="esplay-report-close">
						{done ? $L('Close') : $L('Cancel')}
					</SpottableButton>
					{!done && (
						<SpottableButton
							className={css.buttonPrimary}
							onClick={send}
							disabled={!category || sending}
						>
							{sending ? $L('Sending...') : $L('Send')}
						</SpottableButton>
					)}
				</div>
			</DialogContainer>
		</div>
	);
};

export default EsplayReportDialog;

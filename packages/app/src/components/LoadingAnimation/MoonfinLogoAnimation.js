import css from './LoadingAnimation.module.less';

// EsPlay shows its logo's split play instead of the Moonfin moon: the white top half and the red
// bottom half move apart along the cut and back, once every 1.3 seconds at full speed.
const PLAY = 'M30 22 L30 78 L80 50 Z';

const MoonfinLogoAnimation = ({size, speed}) => {
	const duration = Math.round(1300 / speed) + 'ms';
	const timing = {WebkitAnimationDuration: duration, animationDuration: duration};
	const width = Math.round(size * 0.6);

	return (
		<svg className={css.esplayButton} width={width} height={Math.round(width * 72 / 90)} viewBox="0 14 90 72" aria-hidden="true">
			<defs>
				<clipPath id="esplay-split-top">
					<polygon points="0,0 100,0 100,46 0,58" />
				</clipPath>
				<clipPath id="esplay-split-bottom">
					<polygon points="0,58 100,46 100,100 0,100" />
				</clipPath>
			</defs>
			<line x1="4" y1="58.5" x2="22" y2="56.3" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.9" />
			<g className={css.esplayBottom} style={timing}>
				<g clipPath="url(#esplay-split-bottom)">
					<path d={PLAY} fill="#E71414" stroke="#E71414" strokeWidth="7" strokeLinejoin="round" />
				</g>
			</g>
			<g transform="translate(4 -2.4)">
				<g className={css.esplayTop} style={timing}>
					<g clipPath="url(#esplay-split-top)">
						<path d={PLAY} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="7" strokeLinejoin="round" />
					</g>
				</g>
			</g>
		</svg>
	);
};

export default MoonfinLogoAnimation;

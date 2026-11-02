import css from './LoadingAnimation.module.less';

// EsPlay shows the slanted button of its logo instead of the Moonfin moon: empty, with a red
// band running through it, once every 1.3 seconds at full speed.
const MoonfinLogoAnimation = ({size, speed}) => {
	const duration = Math.round(1300 / speed) + 'ms';

	return (
		<svg className={css.esplayButton} width={size} height={Math.round(size * 44 / 124)} viewBox="-2 0 124 44" aria-hidden="true">
			<defs>
				<clipPath id="esplay-button-clip">
					<rect x="2" y="2" width="116" height="40" rx="9" />
				</clipPath>
			</defs>
			<g transform="translate(4 0) skewX(-10)">
				<rect x="2" y="2" width="116" height="40" rx="9" fill="rgba(255,255,255,.08)" />
				<g clipPath="url(#esplay-button-clip)">
					<rect
						className={css.esplaySweep}
						x="-50" y="2" width="50" height="40" fill="#E71414"
						style={{WebkitAnimationDuration: duration, animationDuration: duration}}
					/>
				</g>
				<rect x="2" y="2" width="116" height="40" rx="9" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
				<path d="M90 15 L90 29 L102 22 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
			</g>
		</svg>
	);
};

export default MoonfinLogoAnimation;

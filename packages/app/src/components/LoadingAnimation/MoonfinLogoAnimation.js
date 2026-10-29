import esplayLogo from './esplayLogo';

import css from './LoadingAnimation.module.less';

// The logo turning a full circle about its upright axis, once every eight seconds at full speed.
// EsPlay shows its own wordmark here instead of the Moonfin moon.
const MoonfinLogoAnimation = ({size, speed}) => {
	const duration = Math.round(8000 / speed) + 'ms';

	return (
		<div
			className={css.logoSpin}
			style={{width: size + 'px', height: size + 'px', display: 'flex', alignItems: 'center', WebkitAnimationDuration: duration, animationDuration: duration}}
		>
			<img src={esplayLogo} width={size} alt="" aria-hidden="true" />
		</div>
	);
};

export default MoonfinLogoAnimation;

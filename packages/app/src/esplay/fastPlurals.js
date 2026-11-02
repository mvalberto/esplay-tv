// EsPlay: every $L() builds an ilib IString and sets its locale, which asks Intl whether it
// knows the locale's plural rules and builds a PluralRules for it. On the TV's browser that
// lookup takes milliseconds, and a screen translates hundreds of strings, so opening a title
// spent most of its time there. The answer and the rules are kept per locale instead.
import IString from 'ilib/lib/IString';
import Locale from 'ilib/lib/Locale';

const available = {};
const rules = {};
const isIntlPluralAvailable = IString.prototype._isIntlPluralAvailable;

IString.prototype._isIntlPluralAvailable = function (locale) {
	const spec = locale.getSpec();
	if (!(spec in available)) available[spec] = isIntlPluralAvailable.call(this, locale);
	return available[spec];
};

// The same steps as ilib's own, with the rules shared.
IString.prototype.setLocale = function (locale, sync, loadParams, onLoad) {
	if (typeof locale === 'object') {
		this.locale = locale;
	} else {
		this.localeSpec = locale;
		this.locale = new Locale(locale);
	}
	if (this._isIntlPluralAvailable(this.locale)) {
		const spec = this.locale.getSpec();
		this.intlPlural = rules[spec] || (rules[spec] = new Intl.PluralRules(spec));
	}
	IString.loadPlurals(typeof sync === 'undefined' || sync, this.locale, loadParams, onLoad);
};

import { define } from 'bundt/config';
import { version } from './package.json';

export default define((input, options) => {
	options.minifySyntax = true;

	options.define = {
		RIAN_VERSION: `"${version}"`,
	};

	options.external?.push('node:async_hooks');

	return options;
});

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { spy, restoreAll } from 'nanospy';

import * as rian from '../src';

test.after.each(() => {
	restoreAll();
});

test('exports', () => {
	assert.type(rian.create, 'function');
});

test('simple', () => {
	const agent = spy();
	const tracer = rian.create('simple', {
		agent: console.log,
	});

	const scope = tracer.fork('some-name');

	scope.setAttributes({
		baz: 'qux',
	});

	scope.measure('test', (scope) => {
		scope.setAttributes({
			foo: 'bar',
		});

		return 'test';
	});

	scope.end();

	tracer.end();
});

test.run();

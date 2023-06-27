import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Suite } from 'benchmark';

import * as rian from '..';
import * as rianAsync from '../async';
import * as assert from 'uvu/assert';

async function runner(
	name: string,
	candidates: Record<string, { setup?: () => any; fn: (...args: any[]) => any }>,
	valid: (p: any) => boolean,
) {
	console.log('\nValidation :: %s', name);
	for (let name of Object.keys(candidates)) {
		const candidate = candidates[name];
		const result = await candidate.fn(candidate.setup?.());
		try {
			assert.ok(valid(result), `${result} is not ok`);
			console.log(`✔`, name);
		} catch (err) {
			console.log('✘', name, `(FAILED @ "${err.message}")`);
		}
	}

	return new Promise((resolve) => {
		console.log('\nBenchmark :: %s', name);
		const bench = new Suite().on('cycle', (e) => console.log('  ' + e.target));
		Object.keys(candidates).forEach((name) => {
			const setup = candidates[name].setup?.();
			bench.add(name + ' '.repeat(22 - name.length), {
				fn: () => candidates[name].fn(setup),
				async: true,
			});
		});

		bench.on('complete', resolve);

		bench.run();
	});
}

const opentelemetrySetup = () => {
	const tracerProvider = new NodeTracerProvider();
	const exporter = new InMemorySpanExporter();
	tracerProvider.addSpanProcessor(new SimpleSpanProcessor(exporter));

	return {
		tracerProvider,
		exporter,
	};
};

(async function () {
	await runner(
		'single span',
		{
			rian: {
				fn: async () => {
					const tracer = rian.tracer('test');

					tracer.span('span 1').end();

					return await rian.report((s) => Array.from(s.scopeSpans)[0].spans);
				},
			},
			'rian/async': {
				fn: async () => {
					rianAsync.tracer('test')(() => {
						rianAsync.span('span 1').end();
					});

					return await rianAsync.report((s) => Array.from(s.scopeSpans)[0].spans);
				},
			},
			opentelemetry: {
				setup: opentelemetrySetup,
				fn: async ({
					tracerProvider,
					exporter,
				}: ReturnType<typeof opentelemetrySetup>) => {
					tracerProvider.getTracer('test').startSpan('span 1').end();
					await tracerProvider.forceFlush();

					return exporter.getFinishedSpans();
				},
			},
		},
		(s) => {
			let spans: any[] = s;
			if (s instanceof Set) spans = Array.from(spans);
			return spans.length === 1;
		},
	);

	await runner(
		'child span',
		{
			rian: {
				fn: async () => {
					const tracer = rian.tracer('test');

					tracer.span('span 1')((s) => {
						s.span('span 2').end();
					});

					return await rian.report((s) => Array.from(s.scopeSpans)[0].spans);
				},
			},
			'rian/async': {
				fn: async () => {
					rianAsync.tracer('test')(() => {
						rianAsync.span('span 1')(() => {
							rianAsync.span('span 2').end();
						});
					});

					return await rianAsync.report((s) => Array.from(s.scopeSpans)[0].spans);
				},
			},
			opentelemetry: {
				setup: opentelemetrySetup,
				fn: async ({
					tracerProvider,
					exporter,
				}: ReturnType<typeof opentelemetrySetup>) => {
					const tracer = tracerProvider.getTracer('test');

					tracer.startActiveSpan('span 1', (span) => {
						const span2 = tracer.startSpan('span 2');
						span2.end();
						span.end();
					});

					await tracerProvider.forceFlush();

					return exporter.getFinishedSpans();
				},
			},
		},
		(s) => {
			let spans: any[] = s;
			if (s instanceof Set) spans = Array.from(spans);
			return spans.length === 2;
		},
	);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});

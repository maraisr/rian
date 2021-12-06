import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Suite } from 'benchmark';
import { MockTracer } from 'opentracing';

import * as rian from 'rian';
import * as assert from 'uvu/assert';

async function runner(
	name: string,
	candidates: Record<
		string,
		{ setup?: () => any; fn: (...args: any[]) => any }
	>,
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
		const bench = new Suite().on('cycle', (e) =>
			console.log('  ' + e.target),
		);
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
					let spans;
					const tracer = rian.create('test', {
						exporter: (s) => (spans = s),
					});

					await tracer.end();
					return spans;
				},
			},
			opentelemetry: {
				setup: opentelemetrySetup,
				fn: async ({
					tracerProvider,
					exporter,
				}: ReturnType<typeof opentelemetrySetup>) => {
					const span = tracerProvider
						.getTracer('test')
						.startSpan('span 1');
					span.end();
					await tracerProvider.forceFlush();

					return exporter.getFinishedSpans();
				},
			},
			opentracing: {
				fn: () => {
					const tracer = new MockTracer();
					tracer.startSpan('test').finish();
					return tracer.report().spans;
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
					let spans;
					const tracer = rian.create('test', {
						exporter: (s) => (spans = s),
					});

					tracer.fork('span 2').end();

					await tracer.end();
					return spans;
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
			opentracing: {
				fn: () => {
					const tracer = new MockTracer();
					const span = tracer.startSpan('test');

					tracer.startSpan('span 2', {
						childOf: span,
					});

					span.finish();
					return tracer.report().spans;
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

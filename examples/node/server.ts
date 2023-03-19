/// <reference path="./node_modules/@types/node/index.d.ts" />

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { configure, currentSpan, report, span, tracer } from 'rian/async';
import { exporter } from 'rian/exporter.otel.http';

configure('my-api', {
	'deployment.environment': 'development',
});

const otel_exporter = exporter((payload) =>
	// local jaeger instance
	fetch('http://localhost:4318/v1/traces', {
		method: 'POST',
		body: JSON.stringify(payload),
		headers: {
			'Content-Type': 'application/json',
		},
	}),
);

async function get_data(name: string) {
	return span('get_data')(
		() =>
			new Promise((resolve) => {
				currentSpan().add_event('got data', {
					name,
					name_length: name.length,
				});

				setTimeout(resolve, Math.random() * 1000, { name });
			}),
	);
}

async function indexHandler(req: IncomingMessage, res: ServerResponse) {
	const data = await get_data('rian');
	res.writeHead(200, {
		'content-type': 'application/json',
	});
	res.write(JSON.stringify(data));
	res.end();
}

const server = createServer((req, res) => {
	// ~> There may be an incoming traceparent.
	const traceparent = req.headers['traceparent'] as string;

	// ~> Create the tracer for this request
	const trace = tracer('rian-example-node', {
		traceparent,
		sampler: () => true, // lets always sample
	});

	const url = new URL(req.url!, `http://${req.headers.host}`);

	trace(() => {
		span(`${req.method} ${url.pathname}`)(() => {
			if (req.url === '/') {
				span('indexHandler')(() => indexHandler(req, res));
			} else {
				res.writeHead(404, {
					'content-type': 'application/json',
				});
				res.write('not found');
				res.end();
			}
		});
	});

	report(otel_exporter);
});

// ~> Lets listen
server.listen(8080);

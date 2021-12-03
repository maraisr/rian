///<reference path="node_modules/@cloudflare/workers-types/index.d.ts"/>

import { create, type Exporter } from 'rian';

const consoleExporter: Exporter = (spans) => {
	console.log(...spans);
};

const fetchHandler: ExportedHandlerFetchHandler<{
	DATA: KVNamespace;
}> = async (req, env, ctx) => {
	const url = new URL(req.url);

	// ~> There may be an incoming traceparent.
	const traceparent = req.headers.get('traceparent');

	// ~> Create the tracer for this request
	const tracer = create(`${req.method} :: ${url.pathname}`, {
		traceparent,
		context: {
			// Any context to be passed to all spans
			'service.name': 'rian-example-cloudflare-workers',
		},
		sampler: () => true, // lets always sample
		exporter: consoleExporter,
	});

	let response: Response;
	if (url.pathname === '/') {
		// ~> Lets see how long KV took to get the data
		const payload = await tracer.measure(
			'retrieve_hello_world',
			async (span) => {
				const kv_key = 'example';

				// ~> you may want to track some context about this span
				span.set_context({
					'kv.key': kv_key,
					type: 'json',
				});

				return env.DATA.get(kv_key, {
					type: 'json',
				});
			},
		);

		response = new Response(JSON.stringify(payload), {
			status: 200,
			headers: {
				'content-type': 'application/json',
				'cache-control': 'public,max-age=10',
			},
		});
	}

	// ~> Don't forget to end the tracer without blocking response
	ctx.waitUntil(tracer.end());

	return (
		response ||
		new Response('not found', {
			status: 404,
		})
	);
};

export default {
	fetch: fetchHandler,
};

///<reference path="node_modules/@cloudflare/workers-types/index.d.ts"/>

import { currentSpan, report, span, tracer } from 'rian/async';

const consoleExporter = (scopes) => {
	console.log(Array.from(scopes.scopeSpans).flatMap((scope) => scope.spans));
};

const trace = tracer('rian-example-cloudflare-workers');

const indexHandler = async (data: KVNamespace) => {
	const payload = await span('get_data')(() => {
		currentSpan().set_context({
			'kv.key': 'example',
			type: 'json',
		});

		return data.get('example', {
			type: 'json',
		});
	});

	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: {
			'content-type': 'application/json',
			'cache-control': 'public,max-age=10',
		},
	});
};

const fetchHandler: ExportedHandlerFetchHandler<{
	DATA: KVNamespace;
}> = async (req, env, ctx) => {
	const url = new URL(req.url);

	// ~> There may be an incoming traceparent.
	const traceparent = req.headers.get('traceparent');

	// ~> Create the tracer for this request
	return trace(async () => {
		const response = span(
			`${req.method} :: ${url.pathname}`,
			traceparent,
		)(async () => {
			if (url.pathname === '/') return indexHandler(env.DATA);
		});

		ctx.waitUntil(report(consoleExporter));

		return (
			response ||
			new Response('not found', {
				status: 404,
			})
		);
	});
};

export default {
	fetch: fetchHandler,
};

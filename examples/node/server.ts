import { createServer } from 'node:http';
import { currentSpan, report, span, tracer } from 'rian/async';

const consoleExporter = (scopes) => {
	console.log(Array.from(scopes.scopeSpans).flatMap((scope) => scope.spans));
};

const get_data = async (name: string) =>
	new Promise((resolve) => {
		currentSpan().set_context({ name_length: name.length });
		setTimeout(resolve, 1e3, { name });
	});

const server = createServer((req, res) => {
	// ~> There may be an incoming traceparent.
	const traceparent = req.headers['traceparent'] as string;

	// ~> Create the tracer for this request
	tracer('rian-example-node', {
		traceparent,
		sampler: () => true, // lets always sample
	})(() => {
		const s = span(`${req.method} :: ${req.url}`);

		if (req.url === '/') {
			res.writeHead(200, {
				'content-type': 'application/json',
			});

			// ~> Lets check how long it takes to get db data
			s.span('db::read')(() => get_data('hello world')).then((data) => {
				res.write(JSON.stringify(data));
				res.end();
			});
		} else {
			res.writeHead(200, {
				'content-type': 'application/json',
			});
			res.write('not found');
			res.end();
		}
	});

	report(consoleExporter);
});

// ~> Lets listen
server.listen(8080);

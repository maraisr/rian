import { createServer } from 'node:http';
import { create, type Exporter } from 'rian';

const consoleExporter: Exporter = (spans) => {
	console.log(...spans);
};

const get_data = async (name: string) =>
	new Promise((resolve) => {
		setTimeout(resolve, 1e3, { name });
	});

const server = createServer((req, res) => {
	// ~> There may be an incoming traceparent.
	const traceparent = req.headers['traceparent'] as string;

	// ~> Create the tracer for this request
	const tracer = create(`${req.method} :: ${req.url}`, {
		traceparent,
		context: {
			// Any context to be passed to all spans
			'service.name': 'rian-example-node',
		},
		sampler: () => true, // lets always sample
		exporter: consoleExporter,
	});

	if (req.url === '/') {
		res.writeHead(200, {
			'content-type': 'application/json',
		});

		// ~> Lets check how long it takes to get db data
		tracer.measure('db::read', get_data, 'hello world').then((data) => {
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

	tracer.end();
});

// ~> Lets listen
server.listen(8080);

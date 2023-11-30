import * as Rian from 'rian/async';
import { exporter } from 'rian/exporter.otel.http';

Rian.configure('bun-api', {
	'bun.version': Bun.version,
});

async function get_data() {
	return Rian.span('get_data')(async () => {
		const users = await Rian.span('SELECT * FROM users')(async (s) => {
			s.set_context({
				'db.system': 'mysql',
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			return [{ user: 'test' }];
		});

		Rian.currentSpan().set_context({
			'users.count': users.length,
		});

		return users;
	});
}

const tracer = Rian.tracer('bun-api');

setInterval(() => {
	Rian.report(
		exporter((p) =>
			fetch('http://127.0.0.1:3000', {
				method: 'POST',
				body: JSON.stringify(p),
			}),
		),
	);
}, 1e3);

Bun.serve({
	port: 8080,
	async fetch(req: Request) {
		const u = new URL(req.url);

		return tracer(async () =>
			Rian.span(`${req.method} ${u.pathname}`)(async (s) => {
				s.set_context({
					'http.method': req.method,
					'http.pathname': u.pathname,
					'http.scheme': u.protocol.replace(':', ''),
					'http.host': u.host,
					'http.port': u.port,
					'bun.development': this.development,
				});

				// Routing
				// -----------------------------------------

				if (u.pathname == '/users') {
					const users = await get_data();
					return new Response(JSON.stringify(users));
				}

				return new Response('', { status: 404 });
			}),
		);
	},
});

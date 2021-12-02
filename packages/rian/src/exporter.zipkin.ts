import { flattie } from 'flattie';
import type * as rian from 'rian';

export interface Config {
	onRequest(payload: any): void;
}

interface Span {
	id: string;
	traceId: string;
	parentId?: string;

	name?: string;
	kind?: string;

	timestamp: number;
	duration?: number;

	tags?: Record<string, string | number | boolean | null>;

	localEndpoint?: {
		serviceName: string;
	};
}

export const exporter =
	(config: Config): rian.Exporter =>
	(spans, context) => {
		const zipkin: Span[] = [];

		for (let span of spans) {
			const kind = span.context.kind;
			delete span.context.kind;

			if ('error' in span.context) {
				const error = span.context.error;
				if ('message' in error) {
					span.context.error = {
						name: error.name,
						message: error.message,
						stack: error.stack,
					};
				} else {
					span.context.error = true;
				}
			}

			zipkin.push({
				id: span.id.parent_id,
				traceId: span.id.trace_id,
				parentId: span.parent?.parent_id,

				name: span.name,

				kind: kind === 'INTERNAL' ? undefined : kind,

				timestamp: span.start * 1000,

				duration: span.end ? (span.end - span.start) * 1000 : undefined,

				localEndpoint: context.localEndpoint,

				tags: flattie(
					Object.assign({}, context, span.context),
					'.',
					true,
				),
			});
		}

		return config.onRequest(zipkin);
	};

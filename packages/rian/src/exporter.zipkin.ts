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
			const { kind, error, ...span_ctx } = span.context;

			if (error) {
				if ('message' in error) {
					span_ctx.error = {
						name: error.name,
						message: error.message,
						stack: error.stack,
					};
				} else {
					span_ctx.error = true;
				}
			}

			zipkin.push({
				id: span.id.parent_id,
				traceId: span.id.trace_id,
				parentId: span.parent ? span.parent.parent_id : undefined,

				name: span.name,

				kind: kind === 'INTERNAL' ? undefined : kind,

				timestamp: span.start * 1000,

				duration: span.end ? (span.end - span.start) * 1000 : undefined,

				localEndpoint: context.localEndpoint,

				tags: flattie(Object.assign({}, context, span_ctx), '.', true),
			});
		}

		return config.onRequest(zipkin);
	};

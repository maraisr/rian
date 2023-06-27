import { flattie } from 'flattie';
import type * as rian from 'rian';

interface Span {
	id: string;
	traceId: string;
	parentId: string | undefined;

	name?: string;
	kind?: string;

	timestamp: number;
	duration: number | undefined;

	tags: Record<string, string | number | boolean | null> | undefined;

	localEndpoint?: {
		serviceName: string;
	};

	annotations?: { value: string; timestamp: number }[];
}

export const exporter =
	(request: (payload: any) => any): rian.Exporter =>
	(trace) => {
		const zipkin: Span[] = [];

		for (let scope of trace.scopeSpans) {
			for (let span of scope.spans) {
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

					localEndpoint: {
						serviceName: `${trace.resource['service.name']}@${scope.scope.name}`,
					},

					tags: flattie(
						{
							...trace.resource,
							...span_ctx,
						},
						'.',
						true,
					),

					annotations: span.events.map((i) => ({
						value: `${i.name} :: ${JSON.stringify(i.attributes)}`,
						timestamp: i.timestamp * 1000,
					})),
				});
			}
		}

		return request(zipkin);
	};

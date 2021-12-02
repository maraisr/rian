import type * as rian from 'rian';

import { name as rian_name, version as rian_version } from 'rian/package.json';
import { convert_object_to_kv } from './internal/helpers';

import {
	type Span,
	SpanKind_CLIENT,
	SpanKind_CONSUMER,
	SpanKind_INTERNAL,
	SpanKind_PRODUCER,
	SpanKind_SERVER,
	SpanStatusCode_ERROR,
	SpanStatusCode_UNSET,
	type Status,
} from './internal/types';

export interface Config {
	onRequest(payload: any): void;
}

const map_kind = (kind: rian.Kind): Span['kind'] => {
	switch (kind) {
		case 'CLIENT':
			return SpanKind_CLIENT;
		case 'SERVER':
			return SpanKind_SERVER;
		case 'CONSUMER':
			return SpanKind_CONSUMER;
		case 'PRODUCER':
			return SpanKind_PRODUCER;
		default:
		case 'INTERNAL':
			return SpanKind_INTERNAL;
	}
};

export const exporter =
	(config: Config): rian.Exporter =>
	(spans, context) => {
		const otel_spans: Span[] = [];

		for (let span of spans) {
			let status: Status;

			if ('error' in span.context) {
				status = {
					code: SpanStatusCode_ERROR,
					message: (span.context.error as Error).message,
				};
				delete span.context.error;
			}

			otel_spans.push({
				traceId: span.id.trace_id,
				spanId: span.id.parent_id,
				parentSpanId: span.parent?.parent_id,

				name: span.name,
				kind: map_kind(span.kind),

				startTimeUnixNano: span.start * 1000000,
				endTimeUnixNano: span.end ? span.end * 1000000 : undefined,

				droppedAttributesCount: 0,
				droppedEventsCount: 0,
				droppedLinksCount: 0,

				attributes: convert_object_to_kv(span.context),

				status: status || { code: SpanStatusCode_UNSET },
			});
		}

		return config.onRequest({
			resourceSpans: [
				{
					resource: {
						attributes: convert_object_to_kv(context),
						droppedAttributesCount: 0,
					},
					instrumentationLibrarySpans: [
						{
							instrumentationLibrary: {
								name: rian_name,
								version: rian_version,
							},
							spans: otel_spans,
						},
					],
				},
			],
		});
	};

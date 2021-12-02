import type * as rian from 'rian';

import { name as rian_name, version as rian_version } from 'rian/package.json';

export interface Config {
	onRequest(payload: any): void;
}

type KeyValue = {
	key: string;
	value: AnyValue;
};

type ArrayValue = {
	values: AnyValue[];
};

type KeyValueList = {
	values: KeyValue[];
};

type AnyValue = {
	stringValue?: string;
	boolValue?: boolean;
	intValue?: number;
	doubleValue?: number;
	arrayValue?: ArrayValue;
	kvlistValue?: KeyValueList;
};

const SpanStatusCode_UNSET = 0;
const SpanStatusCode_OK = 1;
const SpanStatusCode_ERROR = 2;

type Status = {
	code:
		| typeof SpanStatusCode_UNSET
		| typeof SpanStatusCode_OK
		| typeof SpanStatusCode_ERROR;
	message?: string;
};

interface Span {
	traceId: string;
	spanId: string;
	parentSpanId?: string;

	traceState?: string;

	name?: string;
	kind?: number;

	startTimeUnixNano?: number;
	endTimeUnixNano?: number;
	attributes?: KeyValue[] | Record<string, any>;

	status?: Status;

	droppedAttributesCount: number;
	droppedEventsCount: number;
	droppedLinksCount: number;
}

const convert_value_to_anyvalue = (value: any) => {
	let type = typeof value,
		any_value: AnyValue = {};

	if (type === 'string') any_value.stringValue = value;
	else if (type === 'number')
		if (Number.isInteger(value)) any_value.intValue = value;
		else any_value.doubleValue = value;
	else if (type === 'boolean') any_value.boolValue = value;
	else if (Array.isArray(value))
		any_value.arrayValue = {
			values: value.map((i) => convert_value_to_anyvalue(i)),
		};
	else any_value.kvlistValue = { values: convert_object_to_kv(value) };

	return any_value;
};

const convert_object_to_kv = (input: any) => {
	const value: KeyValue[] = [];

	for (let key of Object.keys(input)) {
		value.push({
			key,
			value: convert_value_to_anyvalue(input[key]),
		});
	}

	return value;
};

// https://github.com/open-telemetry/opentelemetry-proto/blob/b43e9b18b76abf3ee040164b55b9c355217151f3/opentelemetry/proto/trace/v1/trace.proto#L127-L155
const map_kind = (kind: any): number => {
	switch (kind) {
		default:
		case 'INTERNAL': {
			return 1;
		}
		case 'SERVER': {
			return 2;
		}
		case 'CLIENT': {
			return 3;
		}
		case 'PRODUCER': {
			return 4;
		}
		case 'CONSUMER': {
			return 5;
		}
	}
};

export const exporter =
	(config: Config): rian.Exporter =>
	(spans, context) => {
		const otel_spans: Span[] = [];

		for (let span of spans) {
			const kind = span.context.kind;
			delete span.context.kind;

			let status: Status;
			if ('error' in span.context) {
				status = {
					code: SpanStatusCode_ERROR,
					// @ts-ignore
					name: (span.context.error as Error).name,
					// @ts-ignore
					stack: (span.context.error as Error).stack,
					// @ts-ignore
					message: (span.context.error as Error).message,
				};
				delete span.context.error;
			}

			otel_spans.push({
				traceId: span.id.trace_id,
				spanId: span.id.parent_id,
				parentSpanId: span.parent?.parent_id,

				name: span.name,
				kind: map_kind(kind || 'INTERNAL'),

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

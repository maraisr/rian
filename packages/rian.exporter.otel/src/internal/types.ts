export type KeyValue = {
	key: string;
	value: AnyValue;
};

export type ArrayValue = {
	values: AnyValue[];
};

export type KeyValueList = {
	values: KeyValue[];
};

export type AnyValue = {
	stringValue?: string;
	boolValue?: boolean;
	intValue?: number;
	doubleValue?: number;
	arrayValue?: ArrayValue;
	kvlistValue?: KeyValueList;
};

export const SpanStatusCode_UNSET = 0;
export const SpanStatusCode_OK = 1;
export const SpanStatusCode_ERROR = 2;

export type Status = {
	code:
		| typeof SpanStatusCode_UNSET
		| typeof SpanStatusCode_OK
		| typeof SpanStatusCode_ERROR;
	message?: string;
};

export const SpanKind_INTERNAL = 0;
export const SpanKind_SERVER = 1;
export const SpanKind_CLIENT = 2;
export const SpanKind_PRODUCER = 3;
export const SpanKind_CONSUMER = 4;

export interface Span {
	traceId: string;
	spanId: string;
	parentSpanId?: string;

	traceState?: string;

	name?: string;
	kind?:
		| typeof SpanKind_INTERNAL
		| typeof SpanKind_SERVER
		| typeof SpanKind_CLIENT
		| typeof SpanKind_PRODUCER
		| typeof SpanKind_CONSUMER;

	startTimeUnixNano?: number;
	endTimeUnixNano?: number;
	attributes?: KeyValue[] | Record<string, any>;

	status?: Status;

	droppedAttributesCount: number;
	droppedEventsCount: number;
	droppedLinksCount: number;
}

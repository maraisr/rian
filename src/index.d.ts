import { Traceparent } from 'tctx';

export type ScopedSpans = {
	scope: Scope;
	spans: Array<Span>;
};

export type Span = {
	label: string;
	id: Traceparent;
	parent: Traceparent | undefined;
	start: number;
	end: number | undefined;
	attributes: Attributes;
	events: {
		label: string;
		timestamp: number;
		attributes: Attributes | undefined;
	}[];
};

export type SpanFn = {
	id: string;
	span(label: string, parent?: Traceparent): SpanFn;
	end(): void;
	set_attributes(a: Attributes | ((a: Attributes) => void)): void;
	add_event(label: string, attributes?: Attributes): void;
};

export type Scope = {
	label: string;
};

export type Sampler = (scope: Scope, label: string, id: Traceparent) => boolean;

export type Options = {
	sample?: boolean | Sampler;
};

export type Attributes = { [property: string]: any };

export type Exporter = (trace: {
	readonly resource: Attributes;
	readonly scopeSpans: ScopedSpans[];
}) => any;

export async function report<T extends Exporter>(
	exporter: T,
): Promise<ReturnType<T>>;

export function configure(label: string, attributes?: Attributes): void;

export function tracer(
	label: string,
	options?: Options,
): {
	span(label: string, parent_id?: string | Traceparent): SpanFn;
	time<T extends (span: SpanFn) => any>(
		label: string,
		arg1: T | string | Traceparent,
		arg2?: T,
	): ReturnType<T>;
};

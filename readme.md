<div align="right">
<img src="files/logo-light.svg#gh-light-mode-only" alt="rian light mode logo" width="200px">
<img src="files/logo-dark.svg#gh-dark-mode-only" alt="rian dark mode logo" width="200px">
<br />
<br />

<p><code>npm add rian</code> doesn't overcomplicate tracing</p>
<span>
<a href="https://github.com/maraisr/rian/actions/workflows/ci.yml">
	<img src="https://github.com/maraisr/rian/actions/workflows/ci.yml/badge.svg"/>
</a>
<a href="https://npm-stat.com/charts.html?package=rian">
	<img src="https://badgen.net/npm/dw/rian?labelColor=black&color=black&cache=600" alt="downloads"/>
</a>
<a href="https://packagephobia.com/result?p=rian">
	<img src="https://badgen.net/packagephobia/install/rian?labelColor=black&color=black" alt="size"/>
</a>
<a href="https://bundlephobia.com/result?p=rian">
	<img src="https://badgen.net/bundlephobia/minzip/rian?labelColor=black&color=black" alt="size"/>
</a>
</span>

<br />
<br />
</div>

## β‘ Features

- π€ **Familiar** β looks very much like OpenTracing.

- β **Simple** β `create` a tracer, and `.end()` a tracer, done.

- π **Performant** β check the [benchmarks](#-benchmark).

- πͺΆ **Lightweight** β a mere 1Kb and next to no [dependencies](https://npm.anvaka.com/#/view/2d/rian/).

## π Usage

> Visit [/examples](/examples) for more info!

```ts
import { create } from 'rian';
import { measure } from 'rian/utils';
import { exporter } from 'rian/exporter.otel.http';

// ~> Where to send the spans.
const otel_endpoint = exporter((payload) =>
  fetch('/traces/otlp', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
);

// ~> Create a tracer β typically "per request" or "per operation"
const tracer = create('GET ~> /data', {
  exporter: otel_endpoint,
});

// Let us trace

tracer.set_context({
  user: request_context.user_id,
});

// ~> Wrap any method and be timed πΊπ»
const data = await measure(tracer.fork('db::read'), get_data);

// ~> Maybe have some in-flow spanning
const span = tracer.span('process records');

for (let row of data) {
  span.add_event('doing stuff', { id: row.id });
  do_stuff(row);
}

span.end();

// ~> And finally let's export β will also end the root span.
await tracer.end();

/*
And we end up with something like this in our reporting tool:

[ GET ~> /data .................................... (1.2ms) ]
   [ db::read .... (0.5ms) ]
                           [ process records .... (0.5ms) ]
 */
```

## π API

#### Module: [`rian`](./packages/rian/src/index.ts)

The main and _default_ module responsible for creating and provisioning spans.

> π‘ Note ~> when providing span context values, please stick to
> [Semantic Conventions](https://github.com/opentracing/specification/blob/master/semantic_conventions.md), but won't be
> enforced.

#### Module: [`rian/exporter.zipkin`](./packages/rian/src/exporter.zipkin.ts)

Exports the spans created using the zipkin protocol and leaves the shipping up to you.

> π‘ Note ~> with the nature of zipkin, the `localEndpoint` must be set in your span context.
>
> <details><summary>Example</summary>
>
> ```ts
> const tracer = create('example', {
>   context: {
>     localEndpoint: {
>       serviceName: 'my-service', // π important part
>     },
>   },
> });
> ```
>
> Both of these are functionally equivalent. `service.name` will be used if no `localEndpoint.serviceName` is set.
>
> ```ts
> const tracer = create('example', {
>   context: {
>     'service.name': 'my-service',
>   },
> });
> ```
>
> </details>

#### Module: [`rian/exporter.otel.http`](./packages/rian/src/exporter.otel.http.ts)

Implements the OpenTelemetry protocol for use with http transports.

> π‘ Note ~> services require a `service.name` context value.
>
> <details><summary>Example</summary>
>
> ```ts
> const tracer = create('example', {
>   context: {
>     'service.name': 'my-service', // π important part
>   },
> });
> ```
>
> </details>

## π§βπ³ Exporter Recipes

<details><summary>NewRelic</summary>

```ts
import { create } from 'rian';
import { exporter } from 'rian/exporter.zipkin';

const newrelic = exporter((payload) =>
  fetch('https://trace-api.newrelic.com/trace/v1', {
    method: 'POST',
    headers: {
      'api-key': '<your api key>',
      'content-type': 'application/json',
      'data-format': 'zipkin',
      'data-format-version': '2',
    },
    body: JSON.stringify(payload),
  }),
);

const tracer = create('example', {
  context: {
    'service.name': 'my-service', // π important part
  },
  exporter: newrelic,
});
```

[learn more](https://docs.newrelic.com/docs/distributed-tracing/trace-api/introduction-trace-api/)

</details>

<details><summary>LightStep</summary>

```ts
import { create } from 'rian';
import { exporter } from 'rian/exporter.otel.http';

const lightstep = exporter((payload) =>
  fetch('https://ingest.lightstep.com/traces/otlp/v0.6', {
    method: 'POST',
    headers: {
      'lightstep-access-token': '<your api key>',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  }),
);

const tracer = create('example', {
  context: {
    'service.name': 'my-service', // π important part
  },
  exporter: lightstep,
});
```

[learn more](https://opentelemetry.lightstep.com/tracing/)

</details>

## π€ Motivation

Firstly, what is `rian`? _trace_ in Irish is `rian`.

In efforts to be better observant citizens, we generally reach for the β NewRelic, LightStep, DataDog's. Which, and in
no offence to them, is bloated and slow! Where they more often than not do way too much or and relatively speaking, ship
useless traces. Which ramp up your bill β see... every span you trace, costs.

And here we are, introducing **rian** β a lightweight, fast effective tracer. Inspired by the giants in the industry,
OpenTracing and OpenTelemetry.

You might have not heard of those before β and that is okay. It means the design goals from OpenTelemetry or OpenTracing
has been met. They are frameworks built to abstract the telemetry part from vendors. So folk like NewRelic can wrap
their layers on top of open telemetry β and have libraries instrument theirs without knowing about the vendor. Which
allows consumers to ship those spans to the vendor of their choosing. OpenTracing has a very similar design goal, so
please do go checkout their documentation's, to help decide.

Rian does not intend to align or compete with them. rian's intent is to be used to instrument your application and
**only** your application. Rian is primed in that critical business paths β where you don't care " which handlers
MongoDB ran", or how many network calls your ORM made. Cardinality will destroy you. Although rian can scale to support
those as well. But the reality is; there are profiler tools far more capable β "right tool for the job".

Rian is simply a tracer you can use to see what your application is doing, have better insight into why something failed
and stitch it with your logs. It starts by capturing a [`w3c trace-context`](https://www.w3.org/TR/trace-context/),
tracing some business steps. "inbound request /data", "getting data", "sending email", or as granular as you'd like. And
have that forwarded onto all sub-services.

You see, the primary design goal is targeted at edge or service workers β where lean quick tracers is favoured.

Rian is still in active development, but ready for production!

## π¨ Benchmark

> via the [`/bench`](/bench) directory with Node v17.2.0

```
Validation :: single span
β rian
β opentelemetry
β opentracing

Benchmark :: single span
  rian                   x 137,181 ops/sec Β±2.82% (82 runs sampled)
  opentelemetry          x 114,197 ops/sec Β±11.37% (75 runs sampled)
  opentracing            x  33,363 ops/sec Β±1.27% (89 runs sampled)

Validation :: child span
β rian
β opentelemetry
β opentracing

Benchmark :: child span
  rian                   x 75,567 ops/sec Β±7.95% (77 runs sampled)
  opentelemetry          x 65,618 ops/sec Β±8.45% (82 runs sampled)
  opentracing            x 15,452 ops/sec Β±15.35% (77 runs sampled)

```

> And please... I know these results are anything but the full story. But it's a number and point on comparison.

## License

MIT Β© [Marais Rossouw](https://marais.io)

##### Disclaimer

<sup>- NewRelic is a registered trademark of https://newrelic.com/ and not affiliated with this project.</sup><br />
<sup>- DataDog is a registered trademark of https://www.datadoghq.com/ and not affiliated with this project.</sup><br />
<sup>- LightStep is a registered trademark of https://lightstep.com/ and not affiliated with this project.</sup>

<div align="right">
<img src="files/logo-light.svg#gh-light-mode-only" alt="rian light mode logo" width="200px">
<img src="files/logo-dark.svg#gh-dark-mode-only" alt="rian dark mode logo" width="200px">
<br />
<br />

<p><code>npm add rian</code> doesn't overcomplicate tracing</p>
<span>
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

## ⚡ Features

- 🤔 **Familiar** — looks very much like opentelemetry.

- ✅ **Simple** — `configure()` an environment, create a `tracer()`, `report()` and done.

- 🏎 **Performant** — check the [benchmarks](#-benchmark).

- 🪶 **Lightweight** — a mere 1KB and next to no [dependencies](https://npm.anvaka.com/#/view/2d/rian/).

## 🚀 Usage

> Visit [/examples](/examples) for more!

```ts
import { configure, tracer, report } from 'rian';
import { exporter } from 'rian/exporter.otel.http';

// ~> configure the environment, all tracers will inherit this
configure('my-service' {
  'service.version': 'DEV'
});

// ~> create a tracer — typically "per request" or "per operation".
const trace = tracer('request');

function handler(req) {
  // ~> start a span
  return trace.span(`${req.method} ${req.path}`)(async (s) => {
    // set some fields on this span's context
    s.set_context({ user_id: req.params.user_id });

    // ~> span again for `db::read`
    const data = await s.span('db::read')(() => db_execute('SELECT * FROM users'));

    // ~> maybe have some manual spanning
    const processing_span = s.span('process records');

    for (let row of data) {
      processing_span.add_event('doing stuff', { id: row.id });
      do_stuff(row);
    }

    // don't forget to end
    processing_span.end();

    return reply(200, { data });
  });
}

const otel_exporter = exporter((payload) =>
  fetch('/traces/otlp', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
);

http.listen((req, executionCtx) => {
  // ~> report all the spans once the response is sent
  executionCtx.defer(() => report(otel_exporter));
  return handler(req);
});

/*
And we end up with something like this in our reporting tool:

[ GET /data ......................................... (1.2ms) ] { request }
   [ db::read .... (0.5ms) ] [ process records .... (0.5ms) ]
   ^                           ^             ^            ^
   { user_id }                 ev { id: 1 }  |            |
                                             ev { id: 2 } |
                                                          ev { id: 3 }
 */
```

You only need to `report` in your application once somewhere. All spans are collected into the same "bucket".

## 🔎 API

#### Module: [`rian`](./packages/rian/src/index.ts)

The main and _default_ module responsible for creating and provisioning spans.

> 💡 Note ~> when providing span context values, you can use
> [Semantic Conventions](https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/), but won't
> be enforced.

#### Module: [`rian/async`](./packages/rian/src/async.ts)

A module that utilizes the `async_hooks` API to provide a `tracer` and `spans` that can be used where the current span
isn't accessible.

> 💡 Note ~> this module should be used mutually exclusively with the main `rian` module.

<details>

<summary>Example</summary>

```ts
import { configure, tracer, span, currentSpan, report } from 'rian/async';
import { exporter } from 'rian/exporter.otel.http';

function handler(req) {
  return span(`${req.method} ${req.path}`)(async () => {
    const s = currentSpan();

    s.set_context({ user_id: req.params.user_id });

    const data = await s.span('db::read')(() => db_execute('SELECT * FROM users'));

    const processing_span = s.span('process records');

    for (let row of data) {
      processing_span.add_event('doing stuff', { id: row.id });
      do_stuff(row);
    }

    processing_span.end();

    return reply(200, { data });
  });
}

const httpTrace = tracer('http');

http.listen((req, executionCtx) => {
  executionCtx.defer(() => report(exporter));
  return httpTrace(() => handler(req));
});
```

</details>

#### Module: [`rian/exporter.zipkin`](./packages/rian/src/exporter.zipkin.ts)

Exports the spans created using the zipkin protocol and leaves the shipping up to you.

#### Module: [`rian/exporter.otel.http`](./packages/rian/src/exporter.otel.http.ts)

Implements the OpenTelemetry protocol for use with http transports.

## 🧑‍🍳 Exporter Recipes

<details><summary>NewRelic</summary>

```ts
import { configure, tracer, report } from 'rian';
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

configure('my-service');

const tracer = tracer('app');

await report(newrelic);
```

[learn more](https://docs.newrelic.com/docs/distributed-tracing/trace-api/introduction-trace-api/)

</details>

<details><summary>Lightstep</summary>

```ts
import { configure, tracer, report } from 'rian';
import { exporter } from 'rian/exporter.otel.http';

const lightstep = exporter((payload) =>
  fetch('https://ingest.lightstep.com/traces/otlp/v0.9', {
    method: 'POST',
    headers: {
      'lightstep-access-token': '<your api key>',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  }),
);

configure('my-service');

const tracer = tracer('app');

await report(lightstep);
```

[learn more](https://opentelemetry.lightstep.com/tracing/)

</details>

## 🤔 Motivation

To clarify, `rian` is the Irish word for "trace".

In our efforts to be observant citizens, we often rely on tools such as NewRelic, Lightstep, and Datadog. However, these
tools can be bloated and slow, often performing too many unnecessary tasks and driving up costs, as every span costs.

This is where rian comes in as a lightweight, fast, and effective tracer inspired by industry giants OpenTracing and
OpenTelemetry. These frameworks were designed to abstract the telemetry part from vendors, allowing libraries to be
instrumented without needing to know about the vendor.

Rian does not intend to align or compete with them, slightly different goals. Rian aims to be used exclusively for
instrumenting your application, particularly critical business paths. While rian can scale to support more complex
constructs, there are profiler tools that are better suited for those jobs. Rian's primary design goal is to provide
better insights into your application's behavior, particularly for edge or service workers where a lean tracer is
favored.

Rian does not by design handle injecting [`w3c trace-context`](https://www.w3.org/TR/trace-context/), or
[propagating baggage](https://www.w3.org/TR/baggage/). But we do expose api's for achieving this.

## 💨 Benchmark

> via the [`/bench`](/bench) directory with Node v17.2.0

```
Validation :: single span
✔ rian
✔ rian/async
✔ opentelemetry

Benchmark :: single span
  rian                   x 277,283 ops/sec ±3.57% (90 runs sampled)
  rian/async             x 279,525 ops/sec ±2.33% (91 runs sampled)
  opentelemetry          x 155,019 ops/sec ±13.13% (70 runs sampled)

Validation :: child span
✔ rian
✔ rian/async
✔ opentelemetry

Benchmark :: child span
  rian                   x 146,793 ops/sec ±3.38% (87 runs sampled)
  rian/async             x 180,488 ops/sec ±1.64% (92 runs sampled)
  opentelemetry          x 102,541 ops/sec ±9.77% (73 runs sampled)
```

> And please... I know these results are anything but the full story. But it's a number and point on comparison.

## License

MIT © [Marais Rossouw](https://marais.io)

##### Disclaimer

<sup>- NewRelic is a registered trademark of https://newrelic.com/ and not affiliated with this project.</sup><br />
<sup>- Datadog is a registered trademark of https://www.datadoghq.com/ and not affiliated with this project.</sup><br />
<sup>- Lightstep is a registered trademark of https://lightstep.com/ and not affiliated with this project.</sup>

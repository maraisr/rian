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

## ⚡ Features

- 🤔 **Familiar** — looks very much like OpenTracing.

- ✅ **Simple** — `create` a tracer, and `.end()` a tracer, done.

- 🏎 **Performant** — check the [benchmarks](#-benchmark).

- 🪶 **Lightweight** — a mere 1Kb and next to no [dependencies](https://npm.anvaka.com/#/view/2d/rian/).

## 🚀 Usage

> Visit [/examples](/examples) for more info!

```ts
import { create } from 'rian';
import { exporter } from 'rian/exporter.otel.http';

// ~> Where to send the spans.
const otel_endpoint = exporter((payload) =>
  fetch('/traces/otlp', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
);

// ~> Create a tracer — typically "per request" or "per operation"
const tracer = create('GET ~> /data', {
  exporter: otel_endpoint,
});

// Let us trace

// ~> Wrap any method and be timed 🕺🏻
const data = await tracer.measure('db::read', get_data);

// ~> Maybe have some in-flow spanning
const span = tracer.span('process records');

for (let row of data) {
  do_stuff(row);
}

span.end();

// ~> And finally let's export — will also end the root span.
await tracer.end();

/*
And we end up with something like this in our reporting tool:

[ GET ~> /data .................................... (1.2ms) ]
   [ db::read .... (0.5ms) ]
                           [ process records .... (0.5ms) ]
 */
```

## 🤔 Motivation

Firstly, what is `rian`? I'm not Irish, but
[_trace_ in Irish is `rian`](https://translate.google.com/?sl=en&tl=ga&text=trace&op=translate&hl=en).

In efforts to be better observant citizens, we generally reach for the — NewRelic, LightStep, DataDog's. Which, and in
no offence to them, is bloated and HUGE! Where they more often than not do way too much or and relatively speaking, ship
useless traces. Which ramp up your bill — see... every span you trace, costs.

And here we are, introducing **rian** — a lightweight, fast effective tracer. Inspired by the giants in the industry,
OpenTracing and OpenTelemetry.

You might have not heard of those before — and that is okay. It means the design goals from OpenTelemetry or OpenTracing
has been met. They are frameworks built to abstract the telemetry part from vendors. So folk like NewRelic can wrap
their layers on top of open telemetry — and have libraries instrument theirs without knowing about the vendor. Which
allows consumers to ship those spans to the vendor of their choosing. OpenTracing has a very similar design goal, so
please do go checkout their documentation's, to help decide.

Rian does not intend to align or compete with them. rian's intent is to be used to instrument your application and
**only** your application. Rian is primed in that critical business paths — where you don't care "which handlers MongoDB
ran", or how many network calls your ORM made. Cardinality will destroy you. Although rian can scale to support those as
well. But the reality is; there are profiler tools far more capable — "right tool for the job".

Rian is simply a tracer you can use to see what your application is doing, have better insight into why something failed
and stitch it with your logs. It starts by capturing a [`w3c trace-context`](https://www.w3.org/TR/trace-context/),
tracing some business steps. "inbound request /data", "getting data", "sending email", or as granular as you'd like. And
have that forwarded onto all sub-services.

You see, the primary design goal is targeted at edge or service workers — where lean quick tracers is favoured.

Rian is still in active development, but ready for production!

## 🔎 API

TODO

## 💨 Benchmark

> via the [`/bench`](/bench) directory with Node v17.2.0

```
TODO
```

## License

MIT © [Marais Rossouw](https://marais.io)

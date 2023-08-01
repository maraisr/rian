import * as Rian from '../async.mjs'

Rian.configure('basic')

await Rian.tracer('basic')(async () => {
    await Promise.all([
        Rian.span('setup')(() => sleep(93)),
        Rian.span('bootstrap')(() => sleep(41)),
        Rian.span('building')(() => sleep(31)),
    ]);

    await Promise.all([
        Rian.span('precompile')(() => sleep(59)),
        sleep(23).then(() => Rian.span('verify')(() => sleep(79))),
    ]);

    Rian.span('background thread');

    await Rian.span('running')(() => {
        return Rian.span('e2e')(async () => {
            await sleep(301);
            return Rian.span('snapshot')(() => sleep(36));
        })
    })

    await sleep(10)

    await Rian.span('url for page /my-product/sleeping-bags-and-tents failed to find a selector')(() => sleep(11));
});

// --

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

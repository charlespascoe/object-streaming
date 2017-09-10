# Type-safe Object Streaming

A type-safe framework for stream processing of objects in TypeScript, useful for efficiently processing streams of data such as reading from a database using a cursor.

The framework provides a number of useful built-in streams, and you can easily create your own.

- [Installation](#installation)
- [Usage](#usage)
- [Concepts](#concepts)
- [Built-In Utility Streams](#built-in-utility-streams)
    - [forEach](#foreachcallback)
    - [map](#mapcallback)
    - [filter](#filtercallback)
    - [branch](#branchcallback-altstream)
    - [split](#splitstreams)
    - [merge](#mergestreams)
    - [batch](#batchoptions)
    - [spread](#spread)
- [Custom Streams](#custom-streams)

# Installation

`$ npm install --save object-streaming`

# Usage

These examples are written in TypeScript, but this module is also completely compatible with plain JavaScript - essentially just remove any type definitions.

Here's a stream that processes numbers:

```typescript
let strm = source<number>();

strm
  .pipe(filter((x: number) => x % 7 !== 0))
  .pipe(map((x: number) => x * 2))
  .pipe(batch({maxItems: 3, idleTimeout: 100}))
  .pipe(forEach((array: number[]) => {
    console.log('Batched array length:', array.length);
  }))
  .pipe(spread())
  .pipe(branch(
    (x: number) => x % 10 === 0,
    forEach((x: number) => console.log(`[${x}]`))
  ))
  .pipe(forEach((x: number) => console.log(x)));



for (let i = 0; i < 20; i++) {
  strm.input(i);
}

// Output:
// Batched array length: 3
// 2
// 4
// 6
// Batched array length: 3
// 8
// [10]
// 12
// Batched array length: 3
// 16
// 18
// [20]
// Batched array length: 3
// 22
// 24
// 26
// Batched array length: 3
// [30]
// 32
// 34
// Batched array length: 2
// 36
// 38
```

# Concepts

Complex processing streams can be constructed by combining multiple simple stream objects. Stream objects define:

- An input type
- An `input` method
- An output type
- An `output` method
- A `pipe` method

A stream accepts an object when `input` is called, does some processing on it, and calls `output` with the results of the processing. A stream can output objects to zero or more streams. `strmA.pipe(strmB)` will cause all outputted objects of `strmA` to be inputted into `strmB`; `pipe` will then return `strmB` so that `strmB`'s output can be piped into something else. This allows for a clean method-chaining API.

Since complex streams are made up of multiple stream objects, the entry and exit stream objects will be different. Therefore, in the following code, `strm` will be a reference to the *last* stream object, not the first:

```typescript
let strm = source<number>()
   .pipe(/* some other stream */)
   .pipe(forEach((x: number) => console.log(x))); // <- 'strm' has a reference to the stream created by this forEach(), not source()
```

If you need both the entry and exit streams, define the entry stream first, then compose the composite stream:

```typescript
let entryStrm = source<number>();

let exitStrm = entryStrm
  .pipe(/* ... */)
  .pipe(/* ... */)
  .pipe(/* ... */)
  .pipe(/* ... */);

// Later in the code...

exitStrm.pipe(forEach(x => console.log(x)));
entryStrm.input('xyz');
```

More conveniently, you can use the `stream` utility function to return a single Stream object, which takes a function with a single argument of the entry (source) stream.

```typescript
let strm = stream<number,string>(src => src
  .pipe(/* ... */)
  .pipe(/* ... */)
  .pipe(/* ... */)
  .pipe(/* ... */)
);

strm.pipe(forEach(x => console.log(x)));
strm.input('xyz');
```

# Built-In Utility Streams

## forEach(*callback*)

For each item that passes through the stream, call the callback, and then pass the item on to the next stream:

```typescript
import { forEach } from 'object-stream';

// ...

strm
  .pipe(forEach((item: SomeClass) => {
    item.foo = true;
    item.bar();
  });
```

## map(*callback*)

Map each item that passes through the stream using the callback, and pass it onto the next stream:

```typescript
import { map } from 'object-stream';

// ...

strm
  .pipe(map((num: number) => new String(num)))
```

## filter(*callback*)

Pass each item into the callback; if it returns true, pass it onto the next stream, otherwise drop the item:

```typescript
import { filter } from 'object-stream';

// ...

strm
   .pipe(filter((item: SomeClass) => item.isFlagChecked()))
```

## branch(*callback*, *altStream*)

Pass each item into the callback; if it returns true, pass it onto the alternate stream, otherwise pass it onto the next stream:

```typescript
import { branch } from 'object-stream';

// ...

strm
  .pipe(branch(
    (item: SomeClass) => true,
    forEach((item: SomeClass) => console.log(item.foo))
  ))
  .pipe(forEach((item: SomeClass) => {
    // This will never run because the branch callback always returns true!
  }));
```

## split(*...streams*)

Each input item is passed to all the given streams, and then passed to the next stream:

```typescript
import { split } from 'object-stream';

// ...

strm
  .pipe(split(
    forEach((num: number) => console.log('A', num))
    forEach((num: number) => console.log('B', num))
    forEach((num: number) => console.log('C', num))
  ))
  .pipe(forEach((num: number) => console.log(num)))

strm.input(123)

// Outputs:
// A 123
// B 123
// C 123
// 123
```

## merge(*...streams*)

Each item outputted by the given streams is passed to the next stream:

```typescript
import { merge } from 'object-stream';

// ...

let strmA = source<number>(),
    strmB = source<number>();

merge(strmA, strmB)
  .pipe(forEach((num: number) => console.log(num)))

strmA.input(123);
strmB.input(456);

// Output:
// 123
// 456
```

`merge` can also be used in-line:

```typescript
let strmA = source<number>(),
    strmB = source<number>(),
    strmC = source<number>();

strmA
  .pipe(map((num: number) => num * 2))
  .pipe(merge(strmA, strmB))
  .pipe(forEach((num: number) => console.log(num)));

strmA.input(123);
strmA.input(456);
strmA.input(789);

// Output:
// 246
// 456
// 789
```

## batch(*options*)

Groups together multiple items into an array:

```typescript
import { batch } from 'object-stream';

// ...

strm
  .pipe(batch({maxItems: 4, idleTimeout: 100}))
  .pipe(forEach((nums: number[]) => console.log(nums)))

for (let i = 0; i < 10; i++) {
  strm.input(i);
}

// Output:
// [0, 1, 2, 3]
// [4, 5, 6, 7]
// [8, 9]
```

The options affect the behaviour of the batcher:

- `maxItems: number` - when the number of items in the batch reaches `maxItems`, then emit the batch
- `idleTimeout: number`  - after receiving an item, when no new items have been received for the duration of the idle timeout (in milliseconds), emit the batch
- `delayTimeout: number` - after receiving the first item into an empty batch, set a timer for the specified duration (in milliseconds); when the timer fires, emit the batch with all the items collected in that time

`idleTimeout` and `delayTimeout` can't be used together.

When no options are provided, it defaults to `idleTimeout = 0`, which emits the batch on the next event loop iteration.

## spread()

Takes an array an passes each item onto the next stream:

```typescript
import { spread } from 'object-stream';

// ...

let strm = source<number[]>();

strm
  .pipe(spread())
  .pipe(forEach((num: number) => console.log(num)));
```

# Custom Streams

There are two main classes for defining custom streams: `SourceStream<T>` and `Stream<I,O>`.

`SourceStream` is used when a class only outputs objects. Call `this.output` to emit an object:

```typescript
import { SourceStream } from 'object-stream';

// ...

class BasicClockStream extends SourceStream<number> {
  constructor() {
    super();

    setInterval(() => this.output(Date.now()), 1000);
  }
}

let clockStrm = new BasicClockStream();

clockStrm.pipe(/* another stream that accepts 'number' */);
```

`Stream` is used when to build stream processing classes that take an input and emit an output. It must define a public `input` method which accepts a single argument of the specified input type:

```typescript
import { Stream } from 'object-stream';

// ...

class IntParseStream extends Stream<string,number> {
  public input(obj: string) {
    if (/\d+/.test(obj)) {
      this.output(parseInt(obj));
    }
  }
}

let ips = new IntParseStream();

ips
  .pipe(forEach((num: number) => console.log(num)));

ips.input('123');
ips.input('abc');
ips.input('456');

// Output:
// 123
// 456
```

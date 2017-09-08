export interface IStreamInput<I> {
  input(obj: I): void;
}


export interface IStreamOutput<O> {
  pipe<T extends IStreamInput<O>>(outputStream: T): T;
}


export abstract class SourceStream<O> implements IStreamOutput<O> {
  private outputStreams: IStreamInput<O>[] = [];

  protected output(obj: O): void {
    for (let outputStream of this.outputStreams) {
      outputStream.input(obj);
    }
  }

  public pipe<T extends IStreamInput<O>>(outputStream: T): T {
    this.outputStreams.push(outputStream);
    return outputStream;
  }
}


export abstract class Stream<I,O> extends SourceStream<O> implements IStreamInput<I> {
  public abstract input(obj: I): void;
}


export class FunctionStream<I,O> extends Stream<I,O> {
  private func: (obj: I, output: (obj: O) => void) => void;

  constructor(func: (obj: I, output: (obj: O) => void) => void) {
    super();
    this.func = func;
    this.output = this.output.bind(this);
  }

  public input(obj: I): void {
    this.func(obj, this.output);
  }
}

export class EntryStream<T> extends Stream<T,T> {
  public input(obj: T) {
    this.output(obj);
  }
}


export interface IBatchOptions {
  maxItems?: number;
  idleTimeout?: number;
  delayTimeout?: number;
}


export class StreamBatcher<T> extends Stream<T,T[]> {
  private options: IBatchOptions;
  private batch: T[] = [];
  private idleTimer: number | null = null;
  private delayTimer: number | null = null;

  constructor(options: IBatchOptions) {
    super();
    this.options = options;

    if (options.idleTimeout !== undefined && options.delayTimeout !== undefined) {
      throw new Error('idleTimeout and delayTimeout are mutually exclusive options');
    }

    if (options.maxItems === undefined && options.idleTimeout === undefined && options.delayTimeout === undefined) {
      options.idleTimeout = 0;
    }
  }

  input(obj: T) {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.batch.push(obj);

    if (this.options.maxItems !== undefined && this.batch.length >= this.options.maxItems) {
      this.emitBatch();
      return;
    }

    if (this.options.idleTimeout !== undefined) {
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        this.emitBatch();
      }, this.options.idleTimeout);
    } else if (this.options.delayTimeout !== undefined && this.delayTimer === null) {
      this.delayTimer = setTimeout(() => {
        this.delayTimer = null;
        this.emitBatch();
      }, this.options.delayTimeout);
    }
  }

  emitBatch() {
    if (this.delayTimer !== null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }

    if (this.batch.length === 0) return;

    this.output(this.batch);
    this.batch = [];
  }
}


export function source<T>(): EntryStream<T> {
  return new EntryStream<T>();
}


export function map<I,O>(func: (obj: I) => O): Stream<I,O> {
  return new FunctionStream<I,O>((obj, output) => {
    output(func(obj));
  });
}


export function filter<T>(predicate: (obj: T) => boolean): Stream<T,T> {
  return new FunctionStream<T,T>((obj, output) => {
    if (predicate(obj)) {
      output(obj);
    }
  });
}


export function forEach<T>(func: (obj: T) => void): Stream<T,T> {
  return new FunctionStream<T,T>((obj, output) => {
    func(obj);
    output(obj);
  });
}


export function branch<T>(predicate: (obj: T) => boolean, altStream: IStreamInput<T>): Stream<T,T> {
  return new FunctionStream<T,T>((obj, output) => {
    if (predicate(obj)) {
      altStream.input(obj);
    } else {
      output(obj);
    }
  });
}


export function split<T>(...streams: IStreamInput<T>[]): Stream<T,T> {
  return new FunctionStream<T,T>((obj, output) => {
    for (let stream of streams) {
      stream.input(obj);
    }

    output(obj);
  });
}


export function merge<T>(...streams: IStreamOutput<T>[]): Stream<T,T> {
  let strm = source<T>();

  for (let stream of streams) {
    stream.pipe(strm);
  }

  return strm;
}


export function batch<T>(options: IBatchOptions = {}): StreamBatcher<T> {
  return new StreamBatcher<T>(options);
}


export function spread<T>(): Stream<T[],T> {
  return new FunctionStream<T[],T>((obj, output) => {
    for (let item of obj) {
      output(item);
    }
  });
}

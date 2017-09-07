export interface IStreamInput<I> {
  input(obj: I): void;
}


export interface IStreamOutput<O> {
  pipe<T extends IStreamInput<O>>(outputStream: T): T;
}


export abstract class Stream<I,O> implements IStreamInput<I>, IStreamOutput<O> {
  private outputStreams: IStreamInput<O>[] = [];

  public abstract input(obj: I): void;

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

export class SourceStream<T> extends Stream<T,T> {
  input(obj: T) {
    this.output(obj);
  }
}


export function source<T>(): SourceStream<T> {
  return new SourceStream<T>();
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

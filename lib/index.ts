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


export class Transform<I,O> extends Stream<I,O> {
  private func: (arg: I) => O;

  constructor(func: (arg: I) => O) {
    super();
    this.func = func;
  }

  public input(obj: I) {
    this.output(this.func(obj));
  }
}


export class StreamBranch<T> extends Stream<T,T> {
  private predicate: (obj: T) => boolean;
  private altStream: IStreamInput<T>;

  constructor(predicate: (obj: T) => boolean, altStream: IStreamInput<T>) {
    super();
    this.predicate = predicate;
    this.altStream = altStream;
  }

  public input(obj: T) {
    if (this.predicate(obj)) {
      this.altStream.input(obj);
    } else {
      this.output(obj);
    }
  }
}


export class StreamFilter<T> extends Stream<T,T> {
  private predicate: (obj: T) => boolean;

  constructor(predicate: (obj: T) => boolean) {
    super();
    this.predicate = predicate;
  }

  input(obj: T) {
    if (this.predicate(obj)) {
      this.output(obj);
    }
  }
}


export function map<I,O>(func: (obj: I) => O): Transform<I,O> {
  return new Transform(func);
}


export function forEach<T>(func: (obj: T) => void): Transform<T,T> {
  return new Transform<T,T>(obj => {
    func(obj);
    return obj;
  });
}

export function branch<T>(predicate: (obj: T) => boolean, altStream: IStreamInput<T>): StreamBranch<T> {
  return new StreamBranch(predicate, altStream);
}

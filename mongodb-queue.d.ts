import { Db, MongoError } from 'mongodb';

declare function mongodbQueue(db: Db, name: string, opts?: mongodbQueue.CreateQueueOptions): mongodbQueue.Queue;

declare namespace mongodbQueue {
  class Queue {
    constructor(db: Db, name: string, opts?: CreateQueueOptions);

    // Promise style functions
    createIndexesAsync(): Promise<string>;
    addAsync(payload: Payload): Promise<string>;
    addAsync(payload: ArrayPayload): Promise<string[]>;
    addAsync(payload: Payload, opts: QueueOptions): Promise<string>;
    addAsync(payload: ArrayPayload, opts: QueueOptions): Promise<string[]>;
    getAsync(): Promise<QueueMessage | undefined>;
    getAsync(opts: QueueOptions): Promise<QueueMessage | undefined>;
    pingAsync(ack: string): Promise<string>;
    pingAsync(ack: string, opts: QueueOptions): Promise<string>;
    ackAsync(ack: string): Promise<string>;
    cleanAsync(): Promise<void>;
    totalAsync(): Promise<number>;
    sizeAsync(): Promise<number>;
    listWaitingAsync(): Promise<QueueMessage[]>;
    inFlightAsync(): Promise<number>;
    listInFlightAsync(): Promise<QueueMessage[]>;
    incompleteAsync(): Promise<number>;
    listIncompleteAsync(): Promise<QueueMessage[]>;
    doneAsync(): Promise<number>;
    killAsync(msg: QueueMessage): Promise<void>;

    // callback style functions
    createIndexes(callback: QueueCallback<string>): void;
    add(payload: Payload, callback: QueueCallback<string>): void;
    add(payload: ArrayPayload, callback: QueueCallback<string[]>): void;
    add(payload: Payload, opts: QueueOptions, callback: QueueCallback<string>): void;
    add(payload: ArrayPayload, opts: QueueOptions, callback: QueueCallback<string[]>): void;
    get(callback: QueueCallback<QueueMessage | undefined>): void;
    get(opts: QueueOptions, callback: QueueCallback<QueueMessage | undefined>): void;
    ping(ack: string, callback: QueueCallback<string>): void;
    ping(ack: string, opts: QueueOptions, callback: QueueCallback<string>): void;
    ack(ack: string, callback: QueueCallback<string>): void;
    clean(callback: QueueCallback<any>): void;
    total(callback: QueueCallback<number>): void;
    size(callback: QueueCallback<number>): void;
    listWaiting(callback: QueueCallback<QueueMessage[]>): void;
    inFlight(callback: QueueCallback<number>): void;
    listInFlight(callback: QueueCallback<QueueMessage[]>): void;
    incomplete(callback: QueueCallback<number>): void;
    listIncomplete(callback: QueueCallback<QueueMessage[]>): void;
    done(callback: QueueCallback<number>): void;
    kill(msg: QueueMessage, callback: QueueCallback<any>): void;
  }

  type Payload = string | Record<string, unknown>;
  type ArrayPayload = Array<string | Record<string, unknown>>;

  interface QueueOptions {
    deadQueue?: Queue | undefined;
    delay?: number | undefined;
    maxRetries?: number | undefined;
    visibility?: number | undefined;
  }

  interface CreateQueueOptions extends QueueOptions {
    ttl?: number | undefined;
  }

  interface QueueMessage {
    ack: string;
    id: string;
    payload: Payload | ArrayPayload;
    tries: number;
  }

  interface QueueCallback<T> {
    (err: MongoError | Error, result: T): void;
  }
}

export = mongodbQueue;

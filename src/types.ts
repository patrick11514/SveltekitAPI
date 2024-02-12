import type { RequestEvent } from '@sveltejs/kit';
import type { Router } from './router.js';
import { Method, Params, Procedure, TypedProcedure } from './server/procedure.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

export type Arrayable<T> = T | T[];

export type Awaitable<T> = T | Promise<T>;

export type AsyncReturnType<T extends (...args: Any) => Any> =
    ReturnType<T> extends Promise<infer U> ? U : ReturnType<T>;

export type CreateContext = (opts: RequestEvent) => Promise<object>;

export type ErrorApiResponse = {
    status: false;
    code: number;
    message: string;
};

export type ReplaceArrayItemsWith<T, R> = T extends Array<Any> ? R[] : T;
export type ReplaceArrayWith<T, R> = T extends Array<Any> ? R : T;

export type ExtractMethod<T> =
    T extends Procedure<Params<Any, Any, infer M, Any>>
        ? M
        : T extends TypedProcedure<Params<Any, Any, infer M, Any>>
          ? M
          : never;

export type DistributeMethods<T> = T extends Any ? ExtractMethod<T> : never;

export type MethodsToRoot<O> = O extends object
    ? {
          [K in keyof O]: O[K] extends Procedure<Params<Any, Any, infer M, Any>>
              ? M
              : O[K] extends TypedProcedure<Params<Any, Any, infer M, Any>>
                ? M
                : O[K] extends Array<Any>
                  ? DistributeMethods<O[K][number]>[]
                  : MethodsToRoot<O[K]>;
      }
    : O;

export type HydrateDataBuilder = { [key: string]: HydrateDataBuilder | Method | Method[] };
export type HydrateData<R extends Router<Any>> = MethodsToRoot<R['endpoints']>;

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;
export type IsAny<T> = IfAny<T, true, false>;

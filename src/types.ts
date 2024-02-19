import type { RequestEvent } from '@sveltejs/kit';
import type { Router } from './router.js';
import { Method, Params, Procedure, TypedProcedure } from './server/procedure.js';

/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

/**
 * @internal
 */
export type Arrayable<T> = T | T[];

/**
 * @internal
 */
export type Awaitable<T> = T | Promise<T>;

export type AsyncReturnType<T extends (...args: Any) => Any> =
    ReturnType<T> extends Promise<infer U> ? U : ReturnType<T>;

export type CreateContext = (opts: RequestEvent) => Promise<object>;

export type ErrorApiResponse = {
    status: false;
    code: number;
    message: string;
};

/**
 * @internal
 */
export type ReplaceArrayItemsWith<T, R> = T extends Array<Any> ? R[] : T;
/**
 * @internal
 */
export type ReplaceArrayWith<T, R> = T extends Array<Any> ? R : T;

/**
 * @internal
 */
export type ExtractMethod<T> =
    T extends Procedure<Params<Any, Any, infer M, Any>>
        ? M
        : T extends TypedProcedure<Params<Any, Any, infer M, Any>>
          ? M
          : never;

/**
 * @internal
 */
export type DistributeMethods<T> = T extends Any ? ExtractMethod<T> : never;

/**
 * @internal
 */
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

/**
 * @internal
 */
export type HydrateDataBuilder = { [key: string]: HydrateDataBuilder | Method | Method[] };
/**
 * @internal
 */
export type HydrateData<R extends Router<Any>> = MethodsToRoot<R['endpoints']>;

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;
/**
 * @internal
 */
export type IsAny<T> = IfAny<T, true, false>;

/**
 * @internal
 */
export type ExtractType<T> =
    T extends Procedure<Params<Any, Any, Any, Any>>
        ? 'NOTHING'
        : T extends TypedProcedure<Params<infer Type, Any, Any, Any>>
          ? Type
          : never;

/**
 * @internal
 */
export type ExtractReturnType<T> =
    T extends Procedure<Params<Any, Any, Any, infer O>>
        ? O
        : T extends TypedProcedure<Params<Any, Any, Any, infer O>>
          ? O
          : never;

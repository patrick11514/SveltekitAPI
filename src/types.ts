import type { RequestEvent } from '@sveltejs/kit'
import type { Router } from './router.js'
import type { Method, Procedure, TypedProcedure } from './server/procedure.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any

export type Arrayable<T> = T | T[]

export type Awaitable<T> = T | Promise<T>

export type AsyncReturnType<T extends (...args: Any) => Any> =
    ReturnType<T> extends Promise<infer U> ? U : ReturnType<T>

export type CreateContext = (opts: RequestEvent) => Promise<object>

export type ErrorApiResponse = {
    status: false
    code: number
    message: string
}

export type ReplaceArrayItemsWith<T, R> = T extends Array<Any> ? R[] : T
export type ReplaceArrayWith<T, R> = T extends Array<Any> ? R : T

export type DeepReplaceWith<O, R> = O extends object
    ? {
          [K in keyof O]: O[K] extends Procedure<Any>
              ? R
              : O[K] extends TypedProcedure<Any>
                ? R
                : O[K] extends Array<Any>
                  ? ReplaceArrayWith<O[K], R[]>
                  : DeepReplaceWith<O[K], R>
      }
    : O

export type HydrateDataBuilder = { [key: string]: HydrateDataBuilder | Method | Method[] }
export type HydrateData<R extends Router<Any>> = DeepReplaceWith<R['endpoints'], Method>

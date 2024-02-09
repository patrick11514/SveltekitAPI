import type { z } from 'zod'
import type { Any, Awaitable } from '../types.js'

export type BaseParams = {
    schema: z.ZodType<unknown>
    input: unknown
    ctx: unknown
}

export type Params<I, C> = {
    schema: z.ZodType<I>
    input: I
    ctx: C
}

type MiddleWareFunction<Base extends BaseParams, After extends BaseParams> = (data: {
    ctx: Base['ctx']
    input: Base['input']
    next: {
        (): Params<Base['input'], Base['ctx']>
        <Context extends object>(newCtx: Context): Params<Base['input'], Context>
    }
}) => Promise<After>

export class BaseProcedure<C extends BaseParams> {
    public middlewares: MiddleWareFunction<C, Any>[] = []

    private clone<NC extends BaseParams>() {
        const clone = new BaseProcedure<NC>()
        clone.middlewares = [...this.middlewares] as Any[]
        return clone
    }

    public use<OutputParams extends BaseParams>(
        middleware: MiddleWareFunction<C, OutputParams>,
    ): BaseProcedure<OutputParams> {
        const clone = this.clone<OutputParams>()
        clone.middlewares.push(middleware as Any)
        return clone
    }

    get GET() {
        return new Procedure<C>('GET', this.middlewares)
    }

    get POST() {
        return new Procedure<C>('POST', this.middlewares)
    }

    get PUT() {
        return new Procedure<C>('PUT', this.middlewares)
    }

    get DELETE() {
        return new Procedure<C>('DELETE', this.middlewares)
    }

    get PATCH() {
        return new Procedure<C>('POST', this.middlewares)
    }
}

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type ExtractParams<C extends Procedure<BaseParams> | TypedProcedure<BaseParams>> =
    C extends Procedure<infer P> ? P : C extends TypedProcedure<infer P> ? P : never

export type CallBackInput = Omit<BaseParams, 'schema'>
export type CallBackInputWithoutInput = Omit<CallBackInput, 'input'>

export class Procedure<C extends BaseParams> {
    public method: Method
    public callback!: (data: CallBackInputWithoutInput) => Awaitable<ResponseInit>
    public middlewares: MiddleWareFunction<C, Any>[] = []

    constructor(method: Method, appliedMiddlewares: MiddleWareFunction<C, Any>[]) {
        this.method = method
        this.middlewares = appliedMiddlewares
    }

    public input<T>(schema: z.ZodType<T>) {
        if (this.method === 'GET') {
            throw new Error('GET method does not support input')
        }
        return new TypedProcedure<Params<T, C['ctx']>>(this.method, this.middlewares as Any, schema)
    }

    public query(callback: (data: CallBackInputWithoutInput) => Awaitable<ResponseInit>) {
        this.callback = callback
        return this
    }
}

export class TypedProcedure<C extends BaseParams> {
    public inputSchema!: C['schema']
    public method: Method
    public callback!: (data: CallBackInput) => Awaitable<ResponseInit>
    public middlewares: MiddleWareFunction<C, Any>[] = []

    constructor(method: Method, appliedMiddlewares: MiddleWareFunction<C, Any>[], schema: C['schema']) {
        this.method = method
        this.middlewares = appliedMiddlewares
        this.inputSchema = schema
    }

    public query(callback: (data: CallBackInput) => Awaitable<ResponseInit>) {
        this.callback = callback
        return this
    }
}

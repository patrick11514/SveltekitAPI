import type { z } from 'zod';
import type { Any, Awaitable } from '../types.js';

export type BaseParams = {
    method: Method;
    schema: z.ZodType<unknown>;
    input: unknown;
    output: unknown;
    ctx: unknown;
};

export type MergeParams<A extends BaseParams, B extends Method> = {
    method: B;
    schema: A['schema'];
    input: A['input'];
    output: A['output'];
    ctx: A['ctx'];
};

export type MergeoutputParams<A extends BaseParams, O> = {
    method: A['method'];
    schema: A['schema'];
    input: A['input'];
    output: O;
    ctx: A['ctx'];
};

export type Params<I, C, M extends Method, O> = {
    method: M;
    schema: z.ZodType<I>;
    input: I;
    output: O;
    ctx: C;
};

type MiddleWareFunction<Base extends BaseParams, After extends BaseParams> = (data: {
    ctx: Base['ctx'];
    input: Base['input'];
    next: {
        (): Params<Base['input'], Base['ctx'], Base['method'], Base['output']>;
        <Context extends object>(newCtx: Context): Params<Base['input'], Context, Base['method'], Base['output']>;
    };
}) => Promise<After>;

export class BaseProcedure<C extends BaseParams> {
    public middlewares: MiddleWareFunction<C, Any>[] = [];

    private clone<NC extends BaseParams>() {
        const clone = new BaseProcedure<NC>();
        clone.middlewares = [...this.middlewares] as Any[];
        return clone;
    }

    public use<OutputParams extends BaseParams>(
        middleware: MiddleWareFunction<C, OutputParams>,
    ): BaseProcedure<OutputParams> {
        const clone = this.clone<OutputParams>();
        clone.middlewares.push(middleware as Any);
        return clone;
    }

    get GET() {
        return new Procedure<MergeParams<C, 'GET'>>(
            'GET',
            this.middlewares as MiddleWareFunction<MergeParams<C, 'GET'>, Any>[],
        );
    }

    get POST() {
        return new Procedure<MergeParams<C, 'POST'>>(
            'POST',
            this.middlewares as MiddleWareFunction<MergeParams<C, 'POST'>, Any>[],
        );
    }

    get PUT() {
        return new Procedure<MergeParams<C, 'PUT'>>(
            'PUT',
            this.middlewares as MiddleWareFunction<MergeParams<C, 'PUT'>, Any>[],
        );
    }

    get DELETE() {
        return new Procedure<MergeParams<C, 'DELETE'>>(
            'DELETE',
            this.middlewares as MiddleWareFunction<MergeParams<C, 'DELETE'>, Any>[],
        );
    }

    get PATCH() {
        return new Procedure<MergeParams<C, 'POST'>>(
            'POST',
            this.middlewares as MiddleWareFunction<MergeParams<C, 'POST'>, Any>[],
        );
    }
}

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ExtractParams<C extends Procedure<BaseParams> | TypedProcedure<BaseParams>> =
    C extends Procedure<infer P> ? P : C extends TypedProcedure<infer P> ? P : never;

export type CallBackInput = Omit<BaseParams, 'schema'>;
export type CallBackInputWithoutInput = Omit<CallBackInput, 'input'>;

export type CallBackFunction<O> = (data: CallBackInput) => Awaitable<O>;
export type CallBackFunctionWithoutInput<O> = (data: CallBackInputWithoutInput) => Awaitable<O>;

export class Procedure<C extends BaseParams> {
    public method: Method;
    public callback!: CallBackFunctionWithoutInput<C['output']>;
    public middlewares: MiddleWareFunction<C, Any>[] = [];

    constructor(method: Method, appliedMiddlewares: MiddleWareFunction<C, Any>[]) {
        this.method = method;
        this.middlewares = appliedMiddlewares;
    }

    public input<T>(schema: z.ZodType<T>) {
        if (this.method === 'GET') {
            throw new Error('GET method does not support input');
        }
        return new TypedProcedure<Params<T, C['ctx'], C['method'], C['output']>>(
            this.method,
            this.middlewares as Any,
            schema,
        );
    }

    public query<O>(callback: CallBackFunctionWithoutInput<O>) {
        this.callback = callback;
        return this as unknown as Procedure<MergeoutputParams<C, O>>;
    }
}

export class TypedProcedure<C extends BaseParams> {
    public inputSchema!: C['schema'];
    public method: Method;
    public callback!: CallBackFunction<C['output']>;
    public middlewares: MiddleWareFunction<C, Any>[] = [];

    constructor(method: Method, appliedMiddlewares: MiddleWareFunction<C, Any>[], schema: C['schema']) {
        this.method = method;
        this.middlewares = appliedMiddlewares;
        this.inputSchema = schema;
    }

    public query<O>(callback: CallBackFunction<O>) {
        this.callback = callback;
        return this as unknown as TypedProcedure<MergeoutputParams<C, O>>;
    }
}

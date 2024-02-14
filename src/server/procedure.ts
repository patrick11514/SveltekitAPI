import { RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import type { Any, Awaitable, ErrorApiResponse, IsAny } from '../types.js';

export type BaseParams = {
    method: Method;
    schema: z.ZodType<unknown>;
    input: unknown;
    output: unknown;
    ctx: unknown;
    ev: RequestEvent;
};

export type MergeParams<A extends BaseParams, B extends Method> = {
    method: B;
    schema: A['schema'];
    input: A['input'];
    output: A['output'];
    ctx: A['ctx'];
    ev: RequestEvent;
};

export type MergeOutputParams<A extends BaseParams, O> = {
    method: A['method'];
    schema: A['schema'];
    input: A['input'];
    output: IsAny<A['output']> extends true ? O : O | A['output'];
    ctx: A['ctx'];
    ev: RequestEvent;
};

export type Params<I, C, M extends Method, O> = {
    method: M;
    schema: z.ZodType<I>;
    input: I;
    output: O;
    ctx: C;
    ev: RequestEvent;
};

type MiddleWareFunction<Base extends BaseParams, After extends BaseParams> = (data: {
    ctx: Base['ctx'];
    input: Base['input'];
    ev: RequestEvent;
    next: {
        (): Params<Base['input'], Base['ctx'], Base['method'], ErrorApiResponse>;
        <Context extends object>(newCtx: Context): Params<Base['input'], Context, Base['method'], ErrorApiResponse>;
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
        return new Procedure<MergeParams<C, 'PATCH'>>(
            'POST',
            this.middlewares as MiddleWareFunction<MergeParams<C, 'PATCH'>, Any>[],
        );
    }
}

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ExtractParams<C extends Procedure<BaseParams> | TypedProcedure<BaseParams>> =
    C extends Procedure<infer P> ? P : C extends TypedProcedure<infer P> ? P : never;

export type CallBackInput<P extends BaseParams> = Omit<P, 'schema' | 'method' | 'output'>;
export type CallBackInputWithoutInput<P extends BaseParams> = Omit<CallBackInput<P>, 'input'>;

export type CallBackFunction<P extends BaseParams, O> = (data: CallBackInput<P>) => Awaitable<O>;
export type CallBackFunctionWithoutInput<P extends BaseParams, O> = (
    data: CallBackInputWithoutInput<P>,
) => Awaitable<O>;

export class Procedure<C extends BaseParams> {
    public method: Method;
    public callback!: CallBackFunctionWithoutInput<C, C['output']>;
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

    public query<O>(callback: CallBackFunctionWithoutInput<C, O>) {
        this.callback = callback;
        return this as unknown as Procedure<MergeOutputParams<C, O>>;
    }
}

export class TypedProcedure<C extends BaseParams> {
    public inputSchema!: C['schema'];
    public method: Method;
    public callback!: CallBackFunction<C, C['output']>;
    public middlewares: MiddleWareFunction<C, Any>[] = [];

    constructor(method: Method, appliedMiddlewares: MiddleWareFunction<C, Any>[], schema: C['schema']) {
        this.method = method;
        this.middlewares = appliedMiddlewares;
        this.inputSchema = schema;
    }

    public query<O>(callback: CallBackFunction<C, O>) {
        this.callback = callback;
        return this as unknown as TypedProcedure<MergeOutputParams<C, O>>;
    }
}

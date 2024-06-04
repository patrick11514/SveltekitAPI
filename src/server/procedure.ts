import { RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import type { Any, Awaitable, ErrorApiResponse, IsAny } from '../types.js';

/**
 * @internal
 * Base params of procedure
 */
export type BaseParams = {
    method: Method;
    schema: z.ZodType<unknown>;
    input: unknown;
    output: unknown;
    ctx: unknown;
    ev: RequestEvent;
};

/**
 * @internal
 * Replaces Method in BaseParams
 * @param $BaseParams BaseParams which got method replaces
 * @param $Method New method for BaseParams
 */
export type MergeParams<$BaseParams extends BaseParams, $NewMethod extends Method> = {
    method: $NewMethod;
    schema: $BaseParams['schema'];
    input: $BaseParams['input'];
    output: $BaseParams['output'];
    ctx: $BaseParams['ctx'];
    ev: RequestEvent;
};

/**
 * @internal
 * Replaces $BaseParam's output to $NewOutput if $BaseParam's output is any, otherwise it creates union of them
 * @param $BaseParams
 * @param $NewOutput
 */
export type MergeOutputParams<$BaseParams extends BaseParams, $NewOutput> = {
    method: $BaseParams['method'];
    schema: $BaseParams['schema'];
    input: $BaseParams['input'];
    output: IsAny<$BaseParams['output']> extends true ? $NewOutput : $NewOutput | $BaseParams['output'];
    ctx: $BaseParams['ctx'];
    ev: RequestEvent;
};

/**
 * @internal
 * Specific params with specific properties
 */
export type Params<$Input, $Context, $Method extends Method, $Output> = {
    method: $Method;
    schema: z.ZodType<$Input>;
    input: $Input;
    output: $Output;
    ctx: $Context;
    ev: RequestEvent;
};

/**
 * Type of MiddleWareFunction
 */
type MiddleWareFunction<$BaseParams extends BaseParams, $AfterParams extends BaseParams> = (data: {
    ctx: $BaseParams['ctx'];
    input: $BaseParams['input'];
    ev: RequestEvent;
    next: {
        (): Params<$BaseParams['input'], $BaseParams['ctx'], $BaseParams['method'], ErrorApiResponse>;
        <$NewContext extends object>(
            newCtx: $NewContext,
        ): Params<$BaseParams['input'], $NewContext, $BaseParams['method'], ErrorApiResponse>;
    };
}) => Promise<$AfterParams>;

/**
 * Base Procedure
 */
export class BaseProcedure<$Params extends BaseParams> {
    /**
     * List of middlewares of that procedure
     */
    public middlewares: MiddleWareFunction<$Params, Any>[] = [];

    /**
     * Clone middlewares to new Procedure
     * @returns New Procedure with same MiddleWares
     */
    private clone<$NewParams extends BaseParams>() {
        const clone = new BaseProcedure<$NewParams>();
        clone.middlewares = [...this.middlewares] as Any[];
        return clone;
    }

    /**
     * Returns new Procedure with additional middleware
     * @param middleware new middleware
     * @returns New procedure with new middleware
     */
    public use<$OutputParams extends BaseParams>(
        middleware: MiddleWareFunction<$Params, $OutputParams>,
    ): BaseProcedure<$OutputParams> {
        const clone = this.clone<$OutputParams>();
        clone.middlewares.push(middleware as Any);
        return clone;
    }

    /**
     * Returns new Procedure with GET method
     * @return New Procedure with same middlewares, but with specific method
     */
    get GET() {
        return new Procedure<MergeParams<$Params, 'GET'>>(
            'GET',
            this.middlewares as MiddleWareFunction<MergeParams<$Params, 'GET'>, Any>[],
        );
    }

    /**
     * Returns new Procedure of POST method
     * @return New Procedure with same middlewares, but with specific method
     */
    get POST() {
        return new Procedure<MergeParams<$Params, 'POST'>>(
            'POST',
            this.middlewares as MiddleWareFunction<MergeParams<$Params, 'POST'>, Any>[],
        );
    }

    /**
     * Returns new Procedure of PUT method
     * @return New Procedure with same middlewares, but with specific method
     */
    get PUT() {
        return new Procedure<MergeParams<$Params, 'PUT'>>(
            'PUT',
            this.middlewares as MiddleWareFunction<MergeParams<$Params, 'PUT'>, Any>[],
        );
    }

    /**
     * Returns new Procedure of DELETE method
     * @return New Procedure with same middlewares, but with specific method
     */
    get DELETE() {
        return new Procedure<MergeParams<$Params, 'DELETE'>>(
            'DELETE',
            this.middlewares as MiddleWareFunction<MergeParams<$Params, 'DELETE'>, Any>[],
        );
    }

    /**
     * Returns new Procedure of PATCH method
     * @return New Procedure with same middlewares, but with specific method
     */
    get PATCH() {
        return new Procedure<MergeParams<$Params, 'PATCH'>>(
            'PATCH',
            this.middlewares as MiddleWareFunction<MergeParams<$Params, 'PATCH'>, Any>[],
        );
    }
}

/**
 * @internal
 * Method type
 */
export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * @internal
 * Extract Params from procedure
 * @param $Procedure Procedure from which is params extracted
 */
export type ExtractParams<$Procedure extends Procedure<BaseParams> | TypedProcedure<BaseParams>> =
    $Procedure extends Procedure<infer $Params>
        ? $Params
        : $Procedure extends TypedProcedure<infer $Params>
          ? $Params
          : never;

/**
 * @internal
 * Return Params without schema, method and output
 */
export type CallBackInput<$Params extends BaseParams> = Omit<$Params, 'schema' | 'method' | 'output'>;
/**
 * @internal
 * Return Params without schema, method, output and input
 */
export type CallBackInputWithoutInput<$Params extends BaseParams> = Omit<CallBackInput<$Params>, 'input'>;

/**
 * @internal
 * Callback function type
 * @param $Params params
 * @param $Output return type of Callback function
 */
export type CallBackFunction<$Params extends BaseParams, $Output> = (
    data: CallBackInput<$Params>,
) => Awaitable<$Output>;

/**
 * @internal
 * Callback function type without input
 * @param $Params params
 * @param $Output return type of Callback function
 */
export type CallBackFunctionWithoutInput<$Params extends BaseParams, $Output> = (
    data: CallBackInputWithoutInput<$Params>,
) => Awaitable<$Output>;

/**
 * Procedure class
 */
export class Procedure<$Params extends BaseParams> {
    public method: Method;
    public callback!: CallBackFunctionWithoutInput<$Params, $Params['output']>;
    public middlewares: MiddleWareFunction<$Params, Any>[] = [];

    /**
     * Constructor
     * @param method Method of this Procedure
     * @param appliedMiddlewares Middlewares of that procedure
     */
    constructor(method: Method, appliedMiddlewares: MiddleWareFunction<$Params, Any>[]) {
        this.method = method;
        this.middlewares = appliedMiddlewares;
    }

    /**
     * Creates typed procedure if method is other than GET
     * @param schema Schema of input data
     * @throws Error if method of Procedure is GET
     * @returns Typed procedure with same params, same middleware and specific schema of data
     */
    public input<T>(schema: z.ZodType<T>) {
        if (this.method === 'GET') {
            throw new Error('GET method does not support input');
        }
        return new TypedProcedure<Params<T, $Params['ctx'], $Params['method'], $Params['output']>>(
            this.method,
            this.middlewares as Any,
            schema,
        );
    }

    /**
     * Binds callback function to this Procedure
     * @param callback Callback called when got Request on endpoint
     * @returns Typed this with correct Return Type
     */
    public query<$Output>(callback: CallBackFunctionWithoutInput<$Params, $Output>) {
        this.callback = callback;
        return this as unknown as Procedure<MergeOutputParams<$Params, $Output>>;
    }
}

/**
 * Procedure class for methods other that GET
 */
export class TypedProcedure<C extends BaseParams> {
    public inputSchema!: C['schema'];
    public method: Method;
    public callback!: CallBackFunction<C, C['output']>;
    public middlewares: MiddleWareFunction<C, Any>[] = [];

    /**
     * Constructor
     * @param method Method of procedure
     * @param appliedMiddlewares Middlewares of procedure
     * @param schema Schema of input
     */
    constructor(method: Method, appliedMiddlewares: MiddleWareFunction<C, Any>[], schema: C['schema']) {
        this.method = method;
        this.middlewares = appliedMiddlewares;
        this.inputSchema = schema;
    }

    /**
     * Binds callback function to this Procedure
     * @param callback Callback called when got Request on endpoint
     * @returns Typed this with correct Return Type
     */
    public query<O>(callback: CallBackFunction<C, O>) {
        this.callback = callback;
        return this as unknown as TypedProcedure<MergeOutputParams<C, O>>;
    }
}

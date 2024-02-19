import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { Router, type RouterObject } from '../router.js';
import type {
    Any,
    CreateContext,
    DistributeMethods,
    ErrorApiResponse,
    ExtractMethod,
    ExtractReturnType,
    ExtractType,
    HydrateData,
    HydrateDataBuilder,
} from '../types.js';
import {
    BaseProcedure,
    Procedure,
    TypedProcedure,
    type CallBackInput,
    type CallBackInputWithoutInput,
    type ExtractParams,
    type Method,
    type Params,
} from './procedure.js';

export const FormDataInput = z.custom<FormData>((data) => {
    if (data instanceof FormData) {
        return true;
    }
    return false;
});

/**
 * @internal
 */
export type ContextMethod<T> = (ev: RequestEvent) => T;

export class APICreate<C> {
    public router<T extends RouterObject>(endpoints: T) {
        return new Router<T>(endpoints);
    }

    get procedure() {
        return new BaseProcedure<Params<unknown, C, Any, Any>>();
    }
}

type FetchFunction<T, O> = T extends 'NOTHING'
    ? (event: RequestEvent) => Promise<O>
    : (event: RequestEvent, data: T) => Promise<O>;

type DistributeFunctions<T, M> = T extends Any
    ? ExtractMethod<T> extends M
        ? FetchFunction<ExtractType<T>, ExtractReturnType<T>>
        : never
    : never;

type FinalObjectBuilder<O> = O extends object
    ? {
          [K in keyof O]: O[K] extends Procedure<Params<Any, Any, Any, infer Output>>
              ? FetchFunction<'NOTHING', Output>
              : O[K] extends TypedProcedure<Params<infer T, Any, Any, infer Output>>
                ? FetchFunction<T, Output>
                : O[K] extends Array<Any>
                  ? {
                        [Key in DistributeMethods<O[K][number]>]: DistributeFunctions<O[K][number], Key>;
                    }
                  : FinalObjectBuilder<O[K]>;
      }
    : O;

export class APIServer<R extends Router<RouterObject>> {
    private router: R;
    private apiPath: string;
    private createContext: CreateContext;
    public ssr!: FinalObjectBuilder<R['endpoints']>;

    constructor(config: { router: R; path: string; context: CreateContext }) {
        this.router = config.router;
        this.apiPath = config.path.endsWith('/') ? config.path : `${config.path}/`;
        this.createContext = config.context;

        this.generateSSR();
    }

    private async handleSSR(event: RequestEvent, data: Any, apiPath: string, method: Method) {
        if (!this.router.includes(apiPath)) {
            return {
                status: false,
                code: 404,
                message: 'Not found',
            } satisfies ErrorApiResponse;
        }

        const path = this.router.getPath(apiPath);

        if (!path) {
            return {
                status: false,
                code: 404,
                message: 'Not found',
            } satisfies ErrorApiResponse;
        }

        const procedure = path[method as Method];

        if (!procedure) {
            return {
                status: false,
                code: 403,
                message: 'Method not supported',
            } satisfies ErrorApiResponse;
        }

        if (method !== 'GET' && procedure instanceof Procedure) {
            return {
                status: false,
                code: 403,
                message: 'Method not supported',
            } satisfies ErrorApiResponse;
        }

        let input: ExtractParams<typeof procedure>['input'] | undefined = undefined;

        if (procedure instanceof TypedProcedure) {
            try {
                if (procedure.inputSchema == FormDataInput) {
                    input = data;
                } else {
                    const parsed = procedure.inputSchema.safeParse(data);

                    if (!parsed.success) {
                        return {
                            status: false,
                            code: 400,
                            message: 'Invalid input',
                        } satisfies ErrorApiResponse;
                    }

                    input = parsed.data;
                }
            } catch (_) {
                return {
                    status: false,
                    code: 400,
                    message: 'Invalid input',
                } satisfies ErrorApiResponse;
            }
        }

        return this.mainHandler(event, procedure, method, input);
    }

    private generateSSR() {
        const endpoints = this.router.endpoints;

        const newObj = {} as Any;

        const toDone: {
            key: string;
            fullPath: string;
            parent: typeof newObj;
            obj: RouterObject;
        }[] = Object.keys(endpoints).map((key) => {
            return {
                key,
                fullPath: key,
                parent: newObj,
                obj: endpoints,
            };
        });

        const createWrapper = (method: Method, path: string) => {
            return (event: RequestEvent, data: Any) => {
                return this.handleSSR(event, data, path, method);
            };
        };

        while (toDone.length != 0) {
            const top = toDone.pop()!;
            const data = top.obj[top.key];

            if (data instanceof Procedure || data instanceof TypedProcedure) {
                top.parent[top.key] = createWrapper(data.method, top.fullPath);
                continue;
            }

            if (Array.isArray(data)) {
                top.parent[top.key] = data.map((procedure) => createWrapper(procedure.method, top.fullPath));
                continue;
            }

            top.parent[top.key] = {};

            toDone.push(
                ...Object.keys(data).map((key) => {
                    return {
                        key,
                        fullPath: top.fullPath + '/' + key,
                        parent: top.parent[top.key] as HydrateDataBuilder,
                        obj: data,
                    };
                }),
            );
        }

        this.ssr = newObj;
    }
    private async mainHandler(
        ev: RequestEvent,
        procedure: Procedure<Any> | TypedProcedure<Any>,
        method: Method,
        input: Any,
    ) {
        let ctx = await this.createContext(ev);

        //handle input with zod from procedure

        for (const middleware of procedure.middlewares) {
            try {
                const result = await Promise.resolve<Params<typeof input, typeof ctx, typeof method, Any>>(
                    middleware({
                        ctx,
                        input,
                        next: <Context extends object>(newCtx?: Context) => {
                            if (newCtx) {
                                return {
                                    schema: procedure instanceof Procedure ? z.unknown() : procedure.inputSchema,
                                    ctx: newCtx,
                                    input,
                                } as Params<
                                    typeof input extends undefined ? unknown : typeof input,
                                    Context,
                                    typeof method,
                                    Any
                                >;
                            }

                            return {
                                schema: procedure instanceof Procedure ? z.unknown() : procedure.inputSchema,
                                ctx,
                                input,
                            } as Params<unknown, Context, typeof method, Any>;
                        },
                        ev,
                    }),
                );

                ctx = result.ctx;
            } catch (e) {
                if (e instanceof MiddleWareError) {
                    return e.data;
                }

                console.error(e);

                return {
                    status: false,
                    code: 500,
                    message: 'Internal server error',
                } satisfies ErrorApiResponse;
            }
        }

        let result: unknown;

        if (procedure instanceof Procedure) {
            result = await Promise.resolve(
                procedure.callback({
                    ctx,
                    ev,
                } as CallBackInputWithoutInput<Any>),
            );
        } else {
            result = await Promise.resolve(
                procedure.callback({
                    ctx,
                    input,
                    ev,
                } as CallBackInput<Any>),
            );
        }

        let finalResponse: object | string | undefined;

        if (result === undefined || result === null) {
            finalResponse = undefined;
        } else if (typeof result === 'string' || typeof result === 'object') {
            finalResponse = result;
        } else {
            finalResponse = {
                status: false,
                code: 500,
                message: 'Internal server error',
            } satisfies ErrorApiResponse;
        }

        return finalResponse;
    }

    private async _handler(ev: RequestEvent) {
        const { request } = ev;
        const { method: baseMethod, url } = request;
        const method = baseMethod.toUpperCase() as Method;

        const fullPath = new URL(url).pathname;

        if (!fullPath.startsWith(this.apiPath)) {
            return json({
                status: false,
                code: 404,
                message: 'Invalid API path',
            } satisfies ErrorApiResponse);
        }

        const apiPath = fullPath.slice(this.apiPath.length);

        if (!this.router.includes(apiPath)) {
            return json({
                status: false,
                code: 404,
                message: 'Not found',
            } satisfies ErrorApiResponse);
        }

        const path = this.router.getPath(apiPath);

        if (!path) {
            return json({
                status: false,
                code: 404,
                message: 'Not found',
            } satisfies ErrorApiResponse);
        }

        const procedure = path[method as Method];

        if (!procedure) {
            return json({
                status: false,
                code: 403,
                message: 'Method not supported',
            } satisfies ErrorApiResponse);
        }

        if (method !== 'GET' && procedure instanceof Procedure) {
            return json({
                status: false,
                code: 403,
                message: 'Method not supported',
            } satisfies ErrorApiResponse);
        }

        let input: ExtractParams<typeof procedure>['input'] | undefined = undefined;

        if (procedure instanceof TypedProcedure) {
            try {
                if (procedure.inputSchema == FormDataInput) {
                    input = await request.formData();
                } else {
                    const jsonData = await request.json();
                    const parsed = procedure.inputSchema.safeParse(jsonData);

                    if (!parsed.success) {
                        return json({
                            status: false,
                            code: 400,
                            message: 'Invalid input',
                        } satisfies ErrorApiResponse);
                    }

                    input = parsed.data;
                }
            } catch (_) {
                return json({
                    status: false,
                    code: 400,
                    message: 'Invalid input',
                } satisfies ErrorApiResponse);
            }
        }

        const data = await this.mainHandler(ev, procedure, method, input);
        return this.createResponse(data);
    }

    private createResponse(data: object | string | undefined) {
        if (typeof data === 'string') {
            return new Response(data);
        } else if (typeof data === 'object') {
            return json(data);
        }
        return new Response();
    }

    public get handler() {
        return this._handler.bind(this);
    }

    //Maybe later require RequestEvent as param, because it contains locals, which `Contains custom data that was added to the request within the handle hook.`
    public hydrateToClient(): HydrateData<R> {
        const endpoints = this.router.endpoints;

        const newObj = {} as HydrateDataBuilder;

        const toDone: {
            key: string;
            parent: typeof newObj;
            obj: RouterObject;
        }[] = Object.keys(endpoints).map((key) => {
            return {
                key,
                parent: newObj,
                obj: endpoints,
            };
        });

        while (toDone.length != 0) {
            const top = toDone.pop()!;
            const data = top.obj[top.key];

            if (data instanceof Procedure || data instanceof TypedProcedure) {
                top.parent[top.key] = data.method;
                continue;
            }

            if (Array.isArray(data)) {
                top.parent[top.key] = data.map((procedure) => procedure.method);
                continue;
            }

            top.parent[top.key] = {};

            toDone.push(
                ...Object.keys(data).map((key) => {
                    return {
                        key,
                        parent: top.parent[top.key] as HydrateDataBuilder,
                        obj: data,
                    };
                }),
            );
        }

        return newObj as HydrateData<R>;
    }
}

export class MiddleWareError extends Error {
    public data: ErrorApiResponse;

    constructor(json: ErrorApiResponse) {
        super(json.message);
        this.data = json;
    }
}

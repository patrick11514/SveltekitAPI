import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { Router, type RouterObject } from '../router.js';
import type { Any, CreateContext, ErrorApiResponse, HydrateData, HydrateDataBuilder } from '../types.js';
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

export type ContextMethod<T> = (ev: RequestEvent) => T;

export class APICreate<C> {
    public router<T extends RouterObject>(endpoints: T) {
        return new Router<T>(endpoints);
    }

    get procedure() {
        return new BaseProcedure<Params<unknown, C, Any, Any>>();
    }
}

export class APIServer<R extends Router<RouterObject>> {
    private router: R;
    private apiPath: string;
    private createContext: CreateContext;

    constructor(config: { router: R; path: string; context: CreateContext }) {
        this.router = config.router;
        this.apiPath = config.path.endsWith('/') ? config.path : `${config.path}/`;
        this.createContext = config.context;
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

        let input: ExtractParams<typeof procedure> | undefined = undefined;

        if (procedure instanceof TypedProcedure) {
            try {
                const jsonData = await request.json();
                const parsed = procedure.inputSchema.safeParse(jsonData);

                if (!parsed.success) {
                    return json({
                        status: false,
                        code: 400,
                        message: 'Invalid input',
                    } satisfies ErrorApiResponse);
                }

                input = jsonData;
            } catch (_) {
                return json({
                    status: false,
                    code: 400,
                    message: 'Invalid input',
                } satisfies ErrorApiResponse);
            }
        }

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
                    }),
                );

                ctx = result.ctx;
            } catch (e) {
                if (e instanceof MiddleWareError) {
                    return json(e.data);
                }

                console.error(e);

                return json({
                    status: false,
                    code: 500,
                    message: 'Internal server error',
                } satisfies ErrorApiResponse);
            }
        }

        let result: unknown;

        if (procedure instanceof Procedure) {
            result = await Promise.resolve(
                procedure.callback({
                    ctx,
                } as CallBackInputWithoutInput<Any>),
            );
        } else {
            result = await Promise.resolve(
                procedure.callback({
                    ctx,
                    input,
                } as CallBackInput<Any>),
            );
        }

        let finalResponse: ResponseInit;

        if (typeof result === 'string') {
            finalResponse = new Response(result);
        } else if (typeof result === 'object') {
            finalResponse = json(result);
        } else if (result === undefined || result === null) {
            finalResponse = new Response();
        } else {
            finalResponse = json({
                status: false,
                code: 500,
                message: 'Internal server error',
            } satisfies ErrorApiResponse);
        }

        return finalResponse;
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

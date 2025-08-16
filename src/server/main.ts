import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { Router, type RouterObject } from '../router.js';
import type {
    CreateContext,
    DistributeMethods,
    DistributeNonMethods,
    ErrorApiResponse,
    ErrorInputResponse,
    ExtractMethod,
    ExtractReturnType,
    ExtractType,
    HydrateData,
    HydrateDataBuilder,
    NonMethods,
    TransformNever,
} from '../types.js';
import {
    BaseParams,
    BaseProcedure,
    Procedure,
    TypedProcedure,
    type CallBackInput,
    type CallBackInputWithoutInput,
    type ExtractParams,
    type Method,
    type Params,
} from './procedure.js';

/**
 * Zod custom type, that checks, if input is FormData
 */
export const AnyFormDataInput = z.custom<FormData>((data) => data instanceof FormData);

/**
 * Back-compat alias: permissive FormData validator (no schema)
 * @deprecated Use AnyFormDataInput or createFormDataInput(schema)
 */
export const FormDataInput = AnyFormDataInput;

/**
 * Zod custom type factory: validates FormData by provided schema
 */
export const createFormDataInput = <$Data>(schema: z.ZodType<$Data>) =>
    z.custom<FormData>((data) => {
        if (!(data instanceof FormData)) return false;
        const object = Object.fromEntries(data.entries());
        const parsed = schema.safeParse(object);
        if (!parsed.success) {
            console.error('FormDataInput validation failed:', parsed.error);
            return false;
        }
        return true;
    });

/**
 * @internal
 * Type of context method
 * @param ev SvelteKit's Request event
 * @return T
 */
export type ContextMethod<T> = (ev: RequestEvent) => T;

/**
 * Class which is used to create Router + Basic Procedure
 */
export class APICreate<$Context> {
    public router<$Router extends RouterObject>(endpoints: $Router) {
        return new Router<$Router>(endpoints);
    }

    get procedure() {
        return new BaseProcedure<Params<unknown, $Context, any, any>>();
    }
}

/**
 * Type of fetch function on server when calling Server.ssr....
 * @param $DataType type of data input
 * @param $ReturnType return type of function
 */
type FetchFunction<$DataType, $ReturnType> = $DataType extends 'NOTHING'
    ? (event: RequestEvent) => Promise<$ReturnType>
    : (event: RequestEvent, data: $DataType) => Promise<$ReturnType>;

/**
 * Extract DataType and Return Type from procedure, if procedure's method and Method doesn't match, it returns never, otherwise it get's Function with DataType and ReturnType
 * @param $Procedure Single procedure, or union of procedures
 * @param $Method Method, which selects correct one from union
 */
type DistributeFunctions<$Procedure, $Method> = $Procedure extends any
    ? ExtractMethod<$Procedure> extends $Method
        ? FetchFunction<ExtractType<$Procedure>, ExtractReturnType<$Procedure>>
        : never
    : never;

type ResolveSingleProcedure<$Procedure> =
    $Procedure extends Procedure<Params<any, any, any, infer $Output>>
        ? FetchFunction<'NOTHING', $Output>
        : $Procedure extends TypedProcedure<Params<infer $Input, any, any, infer $Output>>
          ? FetchFunction<$Input, $Output>
          : never;

type ResolveProcedureArray<$ProcedureArray extends any[]> = {
    [MethodKey in DistributeMethods<$ProcedureArray[number]>]: DistributeFunctions<$ProcedureArray[number], MethodKey>;
} & TransformNever<
    FinalObjectBuilder<NonMethods<DistributeNonMethods<$ProcedureArray[number]>>>,
    Record<string, never>
>;

/**
 * Transform router endpoints object into object of fetch functions, with correspoding parameter types and return types
 * @param $RouterEndpoints Router endpoint's object
 */
type FinalObjectBuilder<$RouterEndpoints> = $RouterEndpoints extends object
    ? {
          [Key in keyof $RouterEndpoints]: $RouterEndpoints[Key] extends Procedure<any> | TypedProcedure<any>
              ? ResolveSingleProcedure<$RouterEndpoints[Key]>
              : $RouterEndpoints[Key] extends any[]
                ? ResolveProcedureArray<$RouterEndpoints[Key]>
                : FinalObjectBuilder<$RouterEndpoints[Key]>;
      }
    : never;

type FormActionWrapper<T> = T extends (event: RequestEvent, data: any) => Promise<infer R>
    ? (event: RequestEvent) => Promise<R>
    : never;

type CreateActionsFromSSR<T> = {
    [K in keyof T]: T[K] extends (event: RequestEvent, data: any) => Promise<any>
        ? FormActionWrapper<T[K]>
        : T[K] extends object
          ? CreateActionsFromSSR<T[K]>
          : never;
};

/**
 * APIServer class, that get's $Router type
 */
export class APIServer<$Router extends Router<RouterObject>> {
    private router: $Router;
    private apiPath: string;
    private createContext: CreateContext;
    public ssr!: FinalObjectBuilder<$Router['endpoints']>;
    public actions!: CreateActionsFromSSR<FinalObjectBuilder<$Router['endpoints']>>;

    /**
     * Constrcutor
     * @param config Config of APIServer
     */
    constructor(config: { router: $Router; path: string; context: CreateContext }) {
        this.router = config.router;
        this.apiPath = config.path.endsWith('/') ? config.path : `${config.path}/`;
        this.createContext = config.context;

        this.generateSSR();
        this.generateActions();
    }

    /**
     * Function to handle SSR got data
     * @param event SvelteKit's RequestEvent
     * @param data Data sent to API
     * @param apiPath Path to API
     * @param method Method
     * @returns Output of mainHandler
     */
    private async handleSSR(event: RequestEvent, data: unknown, apiPath: string, method: Method) {
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
                if (procedure.inputSchema === AnyFormDataInput) {
                    input = data;
                } else {
                    const parsed = procedure.inputSchema.safeParse(data);

                    if (!parsed.success) {
                        const messages = parsed.error.issues.map((issue) => issue.message);

                        return {
                            status: false,
                            code: 400,
                            message: messages,
                        } satisfies ErrorInputResponse;
                    }

                    input = parsed.data;
                }
            } catch (err) {
                console.error(err);
                return {
                    status: false,
                    code: 400,
                    message: 'Invalid input',
                } satisfies ErrorApiResponse;
            }
        }

        return this.mainHandler(event, procedure, method, input);
    }

    /**
     * Generate SSR object on this class
     */
    private generateSSR() {
        const endpoints = this.router.endpoints;

        const newObj = {} as any;

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
            return (event: RequestEvent, data: unknown) => {
                return this.handleSSR(event, data, path, method);
            };
        };

        while (toDone.length !== 0) {
            const top = toDone.pop()!;
            const data = top.obj[top.key];

            if (data instanceof Procedure || data instanceof TypedProcedure) {
                top.parent[top.key] = createWrapper(data.method, top.fullPath);
                continue;
            }

            if (Array.isArray(data)) {
                top.parent[top.key] = {};

                // separate procedures and subroutes
                const procedures: (Procedure<BaseParams> | TypedProcedure<BaseParams>)[] = [];
                // merge objects, last object keys are in priority
                let subRouter: RouterObject = {};

                for (const item of data) {
                    if (item instanceof Procedure || item instanceof TypedProcedure) {
                        procedures.push(item);
                    } else {
                        subRouter = { ...subRouter, ...item };
                    }
                }

                procedures.forEach((procedure) => {
                    top.parent[top.key][procedure.method] = createWrapper(procedure.method, top.fullPath);
                });

                // add subroutes

                toDone.push(
                    ...Object.keys(subRouter).map((key) => {
                        return {
                            key,
                            fullPath: top.fullPath + '/' + key,
                            parent: top.parent[top.key] as HydrateDataBuilder,
                            obj: subRouter,
                        };
                    }),
                );

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

    /**
     * MainHandler that handles all requests of API and SSR
     * @param ev SvelteKit's RequestEvent
     * @param procedure Procedure
     * @param _method Method of Request
     * @param input Input Data
     * @returns Response of API
     */
    private async mainHandler(
        ev: RequestEvent,
        procedure: Procedure<any> | TypedProcedure<any>,
        _method: Method,
        input: any,
    ) {
        let ctx = await this.createContext(ev);

        //handle input with zod from procedure

        for (const middleware of procedure.middlewares) {
            try {
                const result = await Promise.resolve<Params<typeof input, typeof ctx, typeof _method, any>>(
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
                                    typeof _method,
                                    any
                                >;
                            }

                            return {
                                schema: procedure instanceof Procedure ? z.unknown() : procedure.inputSchema,
                                ctx,
                                input,
                            } as Params<unknown, Context, typeof _method, any>;
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
                } as CallBackInputWithoutInput<any>),
            );
        } else {
            result = await Promise.resolve(
                procedure.callback({
                    ctx,
                    input,
                    ev,
                } as CallBackInput<any>),
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

    /**
     * Function that handle's API Requests
     * @param ev SvelteKit's Request Event
     * @returns result of mainHandler wrapped in createResponse
     */
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

        let input: ExtractParams<typeof procedure>['input'] | undefined = undefined;

        if (procedure instanceof TypedProcedure) {
            try {
                if (procedure.inputSchema === AnyFormDataInput) {
                    input = await request.formData();
                } else {
                    let data: string | object = await request.text();

                    try {
                        data = JSON.parse(data);
                    } catch (_err) {
                        /* empty */
                    }

                    const parsed = procedure.inputSchema.safeParse(data);

                    if (!parsed.success) {
                        const messages = parsed.error.issues.map((issue) => issue.message);

                        return json({
                            status: false,
                            code: 400,
                            message: messages,
                        } satisfies ErrorInputResponse);
                    }

                    input = parsed.data;
                }
            } catch (err) {
                console.error(err);
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

    /**
     * Create response based of return data from mainHandler
     * @param data data from mainHandler
     * @returns SvelteKit's Response
     */
    private createResponse(data: object | string | undefined) {
        if (typeof data === 'string') {
            return new Response(data);
        } else if (typeof data === 'object') {
            return json(data);
        }
        return new Response();
    }

    /**
     * Handler used in SvelteKit's +server.ts file and makes sure, that correct this is bind
     *
     * Example:
     * ```TS
     * export const GET = server.handler;
     * export const POST = server.handler;
     * ```
     */
    public get handler() {
        return this._handler.bind(this);
    }

    /**
     * Method, that return's object, that has same structure as Router, but instead of Procedures, it contains name of Methods or Array of Methods of that Endpoint
     * @note Maybe later require RequestEvent as param, because it contains locals, which `Contains custom data that was added to the request within the handle hook.
     * @returns Object structure representing endpoints like this:
     * {
     *      "user": {
     *          "login": ["GET", "POST"] // /api/user/login supports GET and POST method
     *      }
     * }
     */
    public hydrateToClient(): HydrateData<$Router> {
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

        while (toDone.length !== 0) {
            const top = toDone.pop()!;
            const data = top.obj[top.key];

            if (data instanceof Procedure || data instanceof TypedProcedure) {
                top.parent[top.key] = data.method;
                continue;
            }

            if (Array.isArray(data)) {
                // separate procedures and subroutes
                const procedures: (Procedure<BaseParams> | TypedProcedure<BaseParams>)[] = [];
                // merge objects, last object keys are in priority
                let subRouter: RouterObject = {};
                let subRouterSet = false;

                for (const item of data) {
                    if (item instanceof Procedure || item instanceof TypedProcedure) {
                        procedures.push(item);
                    } else {
                        if (subRouterSet === true) {
                            throw new Error('Route can only have single sub-route object.');
                        }
                        subRouterSet = true;
                        subRouter = item;
                    }
                }

                let methodArray: (HydrateDataBuilder | Method)[] = [];

                if (Object.keys(subRouter).length > 0) {
                    const object = {} as HydrateDataBuilder;

                    methodArray = [...procedures.map((procedure) => procedure.method), object];

                    toDone.push(
                        ...Object.keys(subRouter).map((key) => {
                            return {
                                key,
                                parent: object,
                                obj: subRouter,
                            };
                        }),
                    );
                } else {
                    methodArray = procedures.map((procedure) => procedure.method);
                }

                top.parent[top.key] = methodArray;
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

        return newObj as HydrateData<$Router>;
    }

    private createActions(ssrObject: any) {
        const result: any = {};
        for (const key in ssrObject) {
            const value = ssrObject[key];
            if (typeof value === 'function') {
                result[key] = async (event: RequestEvent) => {
                    const form = await event.request.formData();
                    return await value(event, form);
                };
            } else if (typeof value === 'object' && value !== null) {
                result[key] = this.createActions(value);
            }
        }

        return result;
    }

    private generateActions() {
        this.actions = this.createActions(this.ssr);
    }
}

/**
 * MiddleWareError class
 */
export class MiddleWareError extends Error {
    public data: ErrorApiResponse;

    constructor(json: ErrorApiResponse) {
        super(json.message);
        this.data = json;
    }
}

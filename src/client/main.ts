import type { Router, RouterObject } from '../router.js';
import { Params, Procedure, TypedProcedure } from '../server/procedure.js';
import type {
    DistributeMethods,
    DistributeNonMethods,
    ExtractMethod,
    ExtractReturnType,
    ExtractType,
    HydrateData,
    NonMethods,
    TransformNever,
} from '../types.js';

/**
 * Creates a type for fetch function that fetches data from API
 * @param $InputType type of input data
 * @param $ReturnType return type of fetch function
 */
type FetchFunction<$InputType, $ReturnType> = $InputType extends 'NOTHING'
    ? () => Promise<$ReturnType>
    : (data: $InputType) => Promise<$ReturnType>;

type DistributeProcedureFunctions<$Procedure, $HttpMethod> = $Procedure extends any
    ? ExtractMethod<$Procedure> extends $HttpMethod
        ? FetchFunction<ExtractType<$Procedure>, ExtractReturnType<$Procedure>>
        : never
    : never;

type ResolveProcedureArray<$ProcedureArray extends any[]> = {
    [HttpMethod in DistributeMethods<$ProcedureArray[number]>]: DistributeProcedureFunctions<
        $ProcedureArray[number],
        HttpMethod
    >;
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
          [RouteKey in keyof $RouterEndpoints]: $RouterEndpoints[RouteKey] extends Procedure<
              Params<any, any, any, infer $OutputType>
          >
              ? FetchFunction<'NOTHING', $OutputType>
              : $RouterEndpoints[RouteKey] extends TypedProcedure<Params<infer $InputType, any, any, infer $OutputType>>
                ? FetchFunction<$InputType, $OutputType>
                : $RouterEndpoints[RouteKey] extends Array<any>
                  ? ResolveProcedureArray<$RouterEndpoints[RouteKey]>
                  : FinalObjectBuilder<$RouterEndpoints[RouteKey]>;
      }
    : never;

/**
 * Type of API Client for fetching API
 * @param $Router Rounter type
 */
type APIClient<$Router extends Router<RouterObject>> = {
    basePath: string;
    hydrateFromServer: (data: HydrateData<$Router>) => void;
} & FinalObjectBuilder<$Router['endpoints']>;

/**
 * Function that create internally real function, that fetches data from API
 * @param path Path to endpoint
 * @param method Method of endpoint
 * @returns Fetch function with data param
 */
const fetchFunction = (path: string, method: string) => {
    return async (data?: unknown) => {
        let body: BodyInit | undefined;
        if (data !== undefined) {
            if (data instanceof FormData) {
                body = data;
            } else if (typeof data === 'object') {
                body = JSON.stringify(data);
            } else {
                body = data as unknown as BodyInit;
            }
        }

        const request = await fetch(path, {
            method,
            body,
        });

        const text = await request.text();

        try {
            const json = JSON.parse(text);

            return json;
        } catch (_err) {
            return text;
        }
    };
};

/**
 * Creates the client from base path and ensures the correct types based of router
 * @param basePath base path of API
 * @returns client which have method hydrateFromServer, which got data from server and modifies itself to have methods correspoding to API methods
 */
export const createAPIClient = <R extends Router<RouterObject>>(basePath: string) => {
    return {
        basePath,
        hydrateFromServer: function (data: HydrateData<R>) {
            const toDo: {
                fullPath: string;
                key: string;
                // using any here is intentional: we mutate a dynamic tree to attach functions
                parent: any;
                obj: any;
            }[] = Object.keys(data).map((key) => {
                return {
                    fullPath: '/' + key,
                    key,
                    parent: this,
                    obj: data,
                };
            });

            while (toDo.length !== 0) {
                const top = toDo.pop()!;
                const node = top.obj[top.key];

                if (typeof node === 'string') {
                    top.parent[top.key] = fetchFunction(this.basePath + top.fullPath, node);

                    continue;
                }

                if (Array.isArray(node)) {
                    if (!(top.key in top.parent)) {
                        top.parent[top.key] = {};
                    }

                    const procedures: string[] = [];
                    let subRoute: Record<string, unknown> = {};

                    for (const item of node) {
                        if (typeof item === 'object') {
                            subRoute = item as Record<string, unknown>;
                        } else {
                            procedures.push(item);
                        }
                    }

                    procedures.forEach((procedure) => {
                        top.parent[top.key][procedure] = fetchFunction(this.basePath + top.fullPath, procedure);
                    });

                    toDo.push(
                        ...Object.keys(subRoute).map((key) => {
                            return {
                                fullPath: top.fullPath + '/' + key,
                                key,
                                parent: top.parent[top.key],
                                obj: subRoute,
                            };
                        }),
                    );
                    continue;
                }

                top.parent[top.key] = {};

                toDo.push(
                    ...Object.keys(node as Record<string, unknown>).map((key) => {
                        return {
                            fullPath: top.fullPath + '/' + key,
                            key,
                            parent: top.parent[top.key],
                            obj: node,
                        };
                    }),
                );
            }
        },
    } as APIClient<R>;
};

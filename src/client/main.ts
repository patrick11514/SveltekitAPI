import type { Router, RouterObject } from '../router.js';
import { Params, Procedure, TypedProcedure } from '../server/procedure.js';
import type {
    Any,
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

/**
 * Extract DataType and Return Type from procedure, if procedure's method and Method doesn't match, it returns never, otherwise it get's Function with DataType and ReturnType
 * @param $Procedure Single procedure, or union of procedures
 * @param $Method Method, which selects correct one from union
 */
type DistributeFunctions<$Procedure, $Method> = $Procedure extends Any
    ? ExtractMethod<$Procedure> extends $Method
    ? FetchFunction<ExtractType<$Procedure>, ExtractReturnType<$Procedure>>
    : never
    : never;

type DistributeProcedureFunctions<$Procedure, $HttpMethod> = $Procedure extends Any
    ? ExtractMethod<$Procedure> extends $HttpMethod
    ? FetchFunction<ExtractType<$Procedure>, ExtractReturnType<$Procedure>>
    : never
    : never;

type ResolveProcedureArray<$ProcedureArray extends Any[]> = {
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
            Params<Any, Any, Any, infer $OutputType>
        >
        ? FetchFunction<'NOTHING', $OutputType>
        : $RouterEndpoints[RouteKey] extends TypedProcedure<Params<infer $InputType, Any, Any, infer $OutputType>>
        ? FetchFunction<$InputType, $OutputType>
        : $RouterEndpoints[RouteKey] extends Array<Any>
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
    return async (data?: Any) => {
        const request = await fetch(path, {
            method,
            body:
                data !== undefined
                    ? data instanceof FormData
                        ? data
                        : typeof data === 'object'
                            ? JSON.stringify(data)
                            : data
                    : undefined,
        });

        const text = await request.text();

        try {
            const json = JSON.parse(text);

            return json;
        } catch (_) {
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
        hydrateFromServer: function(data: HydrateData<R>) {
            const toDo: {
                fullPath: string;
                key: string;
                parent: Any;
                obj: Any;
            }[] = Object.keys(data).map((key) => {
                return {
                    fullPath: '/' + key,
                    key,
                    parent: this,
                    obj: data,
                };
            });

            while (toDo.length != 0) {
                const top = toDo.pop()!;
                const data = top.obj[top.key];

                if (typeof data === 'string') {
                    top.parent[top.key] = fetchFunction(this.basePath + top.fullPath, data);

                    continue;
                }

                if (Array.isArray(data)) {
                    if (!(top.key in top.parent)) {
                        top.parent[top.key] = {};
                    }

                    const procedures: string[] = [];
                    let subRoute = {};

                    for (const item of data) {
                        if (typeof item === 'object') {
                            subRoute = item;
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
                    ...Object.keys(data).map((key) => {
                        return {
                            fullPath: top.fullPath + '/' + key,
                            key,
                            parent: top.parent[top.key],
                            obj: data,
                        };
                    }),
                );
            }
        },
    } as APIClient<R>;
};

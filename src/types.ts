import type { RequestEvent } from '@sveltejs/kit';
import type { Router } from './router.js';
import { Method, Params, Procedure, TypedProcedure } from './server/procedure.js';

/**
 * @internal
 * Custom Any
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

/**
 * @internal
 * Arrayable type (could be array, but don't)
 */
export type Arrayable<T> = T | T[];

/**
 * @internal
 * Awaitabe type (could return Promis, but don't)
 */
export type Awaitable<T> = T | Promise<T>;

/**
 * Extracts Return type from Function
 */
export type AsyncReturnType<$Function extends (...args: Any) => Any> =
    ReturnType<$Function> extends Promise<infer $ReturnType> ? $ReturnType : ReturnType<$Function>;

/**
 * CreateContext Method
 */
export type CreateContext = (opts: RequestEvent) => Promise<object>;

/**
 * ErrorApiResponse type
 */
export type ErrorApiResponse = {
    status: false;
    code: number;
    message: string;
};

/**
 * @internal
 * If $BaseArray is array, it replaces array to array of $NewType, otherwise it keeps $BaseArray type
 */
export type ReplaceArrayItemsWith<$BaseArray, $NewType> = $BaseArray extends Array<Any> ? $NewType[] : $BaseArray;
/**
 * @internal
 * If $BaseArray is array, it replaces array to $NewArray, otherwise it keeps type of $BaseArray
 */
export type ReplaceArrayWith<$BaseArray, $NewArray> = $BaseArray extends Array<Any> ? $NewArray : $BaseArray;

/**
 * @internal
 * Extracts method from $Procedure
 */
export type ExtractMethod<$Procedure> =
    $Procedure extends Procedure<Params<Any, Any, infer $Method, Any>>
        ? $Method
        : $Procedure extends TypedProcedure<Params<Any, Any, infer $Method, Any>>
          ? $Method
          : never;

/**
 * @internal
 * Tries to extract method from procedure, or union of procedures
 */
export type DistributeMethods<$PossibleProcedure> = $PossibleProcedure extends Any
    ? ExtractMethod<$PossibleProcedure>
    : never;

/**
 * @internal
 * Goes through object of endpoints and convert each procedure to corresponding Method, or array of Methods
 */
export type MethodsToRoot<$RouterEndpoints> = $RouterEndpoints extends object
    ? {
          [$Key in keyof $RouterEndpoints]: $RouterEndpoints[$Key] extends Procedure<
              Params<Any, Any, infer $Method, Any>
          >
              ? $Method
              : $RouterEndpoints[$Key] extends TypedProcedure<Params<Any, Any, infer $Method, Any>>
                ? $Method
                : $RouterEndpoints[$Key] extends Array<Any>
                  ? DistributeMethods<$RouterEndpoints[$Key][number]>[]
                  : MethodsToRoot<$RouterEndpoints[$Key]>;
      }
    : $RouterEndpoints;

/**
 * @internal
 * Type of HydrateDataBuilder
 */
export type HydrateDataBuilder = { [key: string]: HydrateDataBuilder | Method | (Method | HydrateDataBuilder)[] };
/**
 * @internal
 * Type of HydrateData
 */
export type HydrateData<$Router extends Router<Any>> = MethodsToRoot<$Router['endpoints']>;

type IfAny<$Type, $True, $False> = 0 extends 1 & $Type ? $True : $False;
/**
 * @internal
 * Checks if $Type is any
 */
export type IsAny<$Type> = IfAny<$Type, true, false>;

/**
 * @internal
 * Extracts type from procedure, otherwise return 'Nothing'
 */
export type ExtractType<$Procedure> =
    $Procedure extends Procedure<Params<Any, Any, Any, Any>>
        ? 'NOTHING'
        : $Procedure extends TypedProcedure<Params<infer $Type, Any, Any, Any>>
          ? $Type
          : never;

/**
 * @internal
 * Extracts Return type of Procedure
 */
export type ExtractReturnType<$Procedure> =
    $Procedure extends Procedure<Params<Any, Any, Any, infer $Output>>
        ? $Output
        : $Procedure extends TypedProcedure<Params<Any, Any, Any, infer $Output>>
          ? $Output
          : never;

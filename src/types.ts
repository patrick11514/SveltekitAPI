import type { RequestEvent } from '@sveltejs/kit';
import type { Router } from './router.js';
import { Method, Params, Procedure, TypedProcedure } from './server/procedure.js';

/**
 * @internal
 * Arrayable type (could be array, but don't)
 */
export type Arrayable<T> = T | T[];

/**
 * @internal
 * Awaitable type (could return Promise, but don't)
 */
export type Awaitable<T> = T | Promise<T>;

/**
 * Extracts Return type from Function
 */
export type AsyncReturnType<$Function extends (...args: any[]) => any> =
    ReturnType<$Function> extends Promise<infer $ReturnType> ? $ReturnType : ReturnType<$Function>;

/**
 * @internal
 * Helpers to infer parts of Procedure/TypedProcedure once and reuse
 */
type ProcParams<$T> = $T extends Procedure<infer $P> ? $P : $T extends TypedProcedure<infer $P> ? $P : never;
type ProcMethod<$T> = ProcParams<$T> extends Params<any, any, infer $M, any> ? $M : never;
type ProcInput<$T> =
    $T extends Procedure<Params<any, any, any, any>>
        ? 'NOTHING'
        : ProcParams<$T> extends Params<infer $I, any, any, any>
          ? $I
          : never;
type ProcOutput<$T> = ProcParams<$T> extends Params<any, any, any, infer $O> ? $O : never;

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
 * ErrorInputResponse type
 */
export type ErrorInputResponse = {
    status: false;
    code: number;
    message: string[];
};

/**
 * @internal
 * If $BaseArray is array, it replaces array to array of $NewType, otherwise it keeps $BaseArray type
 */
export type ReplaceArrayItemsWith<$BaseArray, $NewType> = $BaseArray extends unknown[] ? $NewType[] : $BaseArray;
/**
 * @internal
 * If $BaseArray is array, it replaces array to $NewArray, otherwise it keeps type of $BaseArray
 */
export type ReplaceArrayWith<$BaseArray, $NewArray> = $BaseArray extends unknown[] ? $NewArray : $BaseArray;

/**
 * @internal
 * Extracts method from $Procedure
 */
export type ExtractMethod<$Procedure> = ProcMethod<$Procedure>;

/**
 * @internal
 * Tries to extract method from procedure, or union of procedures
 */
export type DistributeMethods<$PossibleProcedure> = $PossibleProcedure extends any
    ? ExtractMethod<$PossibleProcedure>
    : never;

/**
 * @internal
 * Extracts method from $Procedure
 */
export type ExtractNonMethod<$Procedure> = ProcParams<$Procedure> extends never ? $Procedure : never;

/**
 * @internal
 * Tries to extract method from procedure, or union of procedures and if it was not possible, return that type
 */
export type DistributeNonMethods<$PossibleProcedure> = $PossibleProcedure extends any
    ? ExtractNonMethod<$PossibleProcedure>
    : never;

/**
 * @internal
 * Goes through object of endpoints and convert each procedure to corresponding Method, or array of Methods
 */
export type MethodsToRoot<$RouterEndpoints> = $RouterEndpoints extends object
    ? {
          [$Key in keyof $RouterEndpoints]: $RouterEndpoints[$Key] extends Procedure<any> | TypedProcedure<any>
              ? ProcMethod<$RouterEndpoints[$Key]>
              : $RouterEndpoints[$Key] extends any[]
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
export type HydrateData<$Router extends Router<any>> = MethodsToRoot<$Router['endpoints']>;

type Ifany<$Type, $True, $False> = 0 extends 1 & $Type ? $True : $False;
/**
 * @internal
 * Checks if $Type is any
 */
export type Isany<$Type> = Ifany<$Type, true, false>;

/**
 * @internal
 * Extracts type from procedure, otherwise return 'Nothing'
 */
export type ExtractType<$Procedure> = ProcInput<$Procedure>;

/**
 * @internal
 * Extracts Return type of Procedure
 */
export type ExtractReturnType<$Procedure> = ProcOutput<$Procedure>;

/**
 * Extract non methods from $PossiblyMethod
 * @param $PossiblyMethod union including methods and other things
 */
export type NonMethods<$PossiblyMethod> = $PossiblyMethod extends Method ? never : $PossiblyMethod;

/**
 * Checks if $PossibleNever is never, and if it returns $NewType, otherwise it keeps $PossibleNever
 */
export type TransformNever<$PossibleNever, $NewType> = [$PossibleNever] extends [never] ? $NewType : $PossibleNever;

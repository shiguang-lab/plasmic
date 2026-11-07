import type { CommerceAPIConfig } from '@plasmicpkgs/commerce';
import type { Agent } from 'node:http';
import type { Options as RetryOptions } from 'async-retry';
import type { RequestInit } from 'node-fetch';
type Actual = NonNullable<Parameters<CommerceAPIConfig['fetch']>[2]>;
// The complete Vercel Fetch 6/7 request contract, including all node-fetch
// options, all async-retry options, and the Retry-After limit.
type Expected = RequestInit & {agent?: Agent;retry?: RetryOptions & {maxRetryAfter?: number}};
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2) ? true : false;
type Assert<T extends true> = T;
export type PreservesFullContract = Assert<Equal<Actual,Expected>>;
export type RejectsStringRetries = Assert<Equal<{retry:{retries:string}} extends Actual?true:false,false>>;
export type RejectsStringTimeout = Assert<Equal<{timeout:string} extends Actual?true:false,false>>;
export type KeepsRetryAfter = Assert<Equal<NonNullable<Actual['retry']>['maxRetryAfter'],number|undefined>>;

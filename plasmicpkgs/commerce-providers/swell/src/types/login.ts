/*
  Forked from https://github.com/vercel/commerce/tree/main/packages/swell/src
  Changes: None
*/
import * as Core from '@plasmicpkgs/commerce/dist/types/login'
import { LoginBody, LoginTypes } from '@plasmicpkgs/commerce/dist/types/login'

export * from '@plasmicpkgs/commerce/dist/types/login'

export type LoginHook<T extends LoginTypes = LoginTypes> = {
  data: null
  actionInput: LoginBody
  fetcherInput: LoginBody
  body: T['body']
}

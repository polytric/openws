export { runtime } from '../fluent'
export { bindings } from './bindings'
export * from './network'
export * from './role'
export * from './message'

type ExtractInstance<T> = T extends new (...args: any[]) => infer I ? I : T

export type Api<T> = {
    [K in keyof ExtractInstance<T> as K extends 'constructor'
        ? never
        : ExtractInstance<T>[K] extends (...args: any[]) => any
          ? K
          : never]: (payload: any) => Promise<any>
}

import { CustomDirectusTypes } from './DirectusTypes'

export type PropertiesOnly<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K]
}

export type TableName = keyof CustomDirectusTypes
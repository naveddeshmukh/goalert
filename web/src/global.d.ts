/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable no-var */

declare namespace NodeJS {
  declare module '*.md'
  declare module '*.png'
  declare module '*.svg'
}

var pathPrefix: string
var applicationName: string
var GOALERT_VERSION: string
var Cypress: any
var nonce: string

import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { LRUCache } from 'lru-cache'
import kink from '~/code/errors/definitions'

const DEFAULT_MAX_SOCKETS = 50

const AGENT_CACHE = new LRUCache({ max: 50 })

export type ProxyAgentOptions = {
  ca?: string | Array<string>
  cert?: string | Array<string>
  httpProxy?: string
  httpsProxy?: string
  key?: string
  localAddress?: string
  maxSockets?: number
  noProxy?: boolean | string
  strictSsl?: boolean
  timeout?: number
  clientCertificates?: {
    [registryUrl: string]: {
      cert: string
      key: string
      ca?: string
    }
  }
}

export function getProxyAgent({
  uri,
  ...opts
}: { uri: string } & ProxyAgentOptions) {
  const parsedUri = new URL(uri)
  const pxuri = getProxyUri(parsedUri, opts)
  if (!pxuri) {
    return
  }
  const isHttps = parsedUri.protocol === 'https:'

  const key = [
    `https=${isHttps.toString()}`,
    `proxy=${pxuri.protocol}//${pxuri.username}:${pxuri.password}@${pxuri.host}:${pxuri.port}`,
    `local-address=${opts.localAddress ?? '>no-local-address<'}`,
    `strict-ssl=${
      isHttps ? Boolean(opts.strictSsl).toString() : '>no-strict-ssl<'
    }`,
    `ca=${(isHttps && opts.ca?.toString()) || '>no-ca<'}`,
    `cert=${(isHttps && opts.cert?.toString()) || '>no-cert<'}`,
    `key=${(isHttps && opts.key) || '>no-key<'}`,
  ].join('&')

  if (AGENT_CACHE.peek(key)) {
    return AGENT_CACHE.get(key)
  }

  const proxy = getProxy({ url: pxuri, isHttps, ...opts })
  AGENT_CACHE.set(key, proxy)
  return proxy
}

function getProxyUri({
  uri,
  httpProxy,
  httpsProxy,
}: {
  uri: URL
  httpProxy?: string
  httpsProxy?: string
}): URL | undefined {
  const { protocol } = uri

  let proxy: string | undefined
  switch (protocol) {
    case 'http:': {
      proxy = httpProxy
      break
    }
    case 'https:':
    default: {
      proxy = httpsProxy
      break
    }
  }

  if (!proxy) {
    return undefined
  }

  if (!proxy.includes('://')) {
    proxy = `${protocol}//${proxy}`
  }

  if (typeof proxy !== 'string') {
    return proxy
  }

  try {
    return new URL(proxy)
  } catch (err) {
    throw kink('invalid_proxy', { url: proxy })
  }
}

function getProxy({
  url,
  ca,
  cert,
  key,
  timeout,
  localAddress,
  maxSockets,
  strictSsl,
  isHttps,
}: {
  url: URL
  ca?: string | Array<string>
  cert?: string | Array<string>
  key?: string
  timeout?: number
  localAddress?: string
  maxSockets?: number
  strictSsl?: boolean
  isHttps: boolean
}) {
  const popts = {
    auth: getAuth(url),
    ca: ca,
    cert: cert,
    host: url.hostname,
    key: key,
    localAddress: localAddress,
    maxSockets: maxSockets ?? DEFAULT_MAX_SOCKETS,
    path: url.pathname,
    port: url.port ? parseInt(url.port) : undefined,
    protocol: url.protocol,
    rejectUnauthorized: strictSsl,
    timeout:
      typeof timeout !== 'number' || timeout === 0 ? 0 : timeout + 1,
  }

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    if (!isHttps) {
      return new HttpProxyAgent(url, popts)
    } else {
      return new HttpsProxyAgent(url, popts)
    }
  }

  if (url.protocol?.startsWith('socks')) {
    return new SocksProxyAgent(url, popts)
  }
  return undefined
}

function getAuth(user: { username?: string; password?: string }) {
  if (!user.username) {
    return undefined
  }
  let auth = user.username
  if (user.password) {
    auth += `:${user.password}`
  }
  return decodeURIComponent(auth)
}

import Kink from '@termsurf/kink'

const host = '@termsurf/mesh'

type Base = {
  abort_error: {
    take: {
      link: string
    }
  }
  invalid_proxy: {
    take: {
      url: string
    }
  }
}

let CODE_INDEX = 1

const CODE = {
  abort_error: CODE_INDEX++,
  invalid_proxy: CODE_INDEX++,
}

type Name = keyof Base

Kink.code(host, (code: number) => code.toString(16).padStart(4, '0'))

Kink.base(host, 'abort_error', (take: Base['abort_error']['take']) => ({
  code: CODE.abort_error,
  note: 'Call aborted.',
  link: take.link,
}))

Kink.base(
  host,
  'invalid_proxy',
  (take: Base['invalid_proxy']['take']) => ({
    code: CODE.invalid_proxy,
    note: `Couldn't parse proxy URL.`,
    link: take,
    hint: `If your proxy URL contains a username and password, make sure to URL-encode them (you may use the encodeURIComponent function). For instance, https-proxy=https://use%21r:pas%2As@my.proxy:1234/foo. Do not encode the colon (:) between the username and password.`,
  }),
)

export default function kink<N extends Name>(
  form: N,
  link?: Base[N]['take'],
  siteCode?: number,
) {
  const kink = Kink.make(host, form, link)
  if (siteCode) {
    kink.siteCode = siteCode
  }
  return kink
}

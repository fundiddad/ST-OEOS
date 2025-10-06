let urlIdCounter = 0

const allowedUrlMatcher = /^https?:\/\/.+|^data:image\/.+/

const locatorSiteLinks = [
  {
    matcher: u => {
      const r =
        u &&
        u.match(
          /^https:\/\/(thumbs[0-9]*\.*redgifs\.com)\/([a-zA-Z0-9]+)(-mobile|).mp4/
        )
      if (r) {
        return {
          name: 'RedGifs',
          link: 'https://www.redgifs.com/watch/' + r[2].toLowerCase(),
          thumb: 'https://' + r[1] + '/' + r[2] + '.jpg',
          hit: o => {},
          embed:
            'https://www.redgifs.com/ifr/' + r[2].toLowerCase() + '?autoplay=0',
        }
      }
    },
  },
]

function getSiteLink(href) {
  for (const m of locatorSiteLinks) {
    const r = m.matcher(href)
    if (r) return r
  }
}

export default {
  data: () => ({}),
  methods: {
    hasInPreloadPool() {
      // This is now unused, but other parts of the code might call it.
      // To be safe, let's have it return false.
      return false
    },
    locatorLookup(locator) {
      if (typeof locator !== 'string') {
        return null
      }
      const link = this.lookupRemoteLink(locator)
      if (link) {
        return link
      }

      console.error('Invalid locator (must be a URL):', locator)
      return {
        href: 'invalid-locator',
        error: 'Invalid locator (must be a URL): ' + locator,
      }
    },
    lookupRemoteLink(locator) {
      const urlMatch =
        typeof locator === 'string' && locator.match(allowedUrlMatcher)
      if (!urlMatch) {
        return
      }

      const id = ++urlIdCounter
      const image = {
        href: locator,
        item: {
          hash: id,
          id: id,
        },
        locator: locator,
        noReferrer: true,
        siteLink: getSiteLink(locator),
      }
      return image
    },
  },
}

import { defineEventHandler, setResponseStatus } from 'h3'

const ignorePathList = ['/dev-sw.js']

export default defineEventHandler((event) => {
  const url = event.node.req.url ?? ''
  if (ignorePathList.some(path => url.startsWith(path))) {
    setResponseStatus(event, 404)
    return null
  }
})

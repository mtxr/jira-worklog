const request = require('request')
const qs = require('querystring')

let username = null
let password = null
let server = null
let protocol = null
let version = null

function setup (u, p, s, pro, v) {
  username = u
  password = p
  server = s
  protocol = pro
  version = v
}

function search (jql, cb = undefined) {
  const query = {
    fields: ['key'].join(','),
    jql
  }
  return request({
    method: 'GET',
    url: `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${server}/rest/api/${version}/search?${qs.stringify(query)}`,
    strictSSL: false
  }, cb)
}

function worklog (id, cb = undefined) {
  return request({
    method: 'GET',
    url: `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${server}/rest/api/${version}/issue/${id}/worklog`,
    strictSSL: false
  }, cb)
}

function createWorklog (id, body, cb = undefined) {
  return request({
    method: 'POST',
    url: `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${server}/rest/api/${version}/issue/${id}/worklog`,
    strictSSL: false,
    json: body
  }, cb)
}

module.exports = {
  setup,
  search,
  worklog,
  createWorklog
}

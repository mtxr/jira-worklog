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

function search (jql) {
  return request({
    method: 'GET',
    url: `${protocol}://${username}:${password}@${server}/rest/api/${version}/search?${qs.stringify(jql)}`,
    strictSSL: false
  })
}

function worklog (id) {
  return request({
    method: 'GET',
    url: `${protocol}://${username}:${password}@${server}/rest/api/${version}/issue/${id}/worklog`,
    strictSSL: false
  })
}

function createWorklog (id, body) {
  return request({
    method: 'POST',
    url: `${protocol}://${username}:${password}@${server}/rest/api/${version}/issue/${id}/worklog`,
    strictSSL: false,
    json: body
  })
}

module.exports = {
  setup,
  search,
  worklog,
  createWorklog
}

#!/usr/bin/env node

const cfg = require('./config.json')
const open = require('open')
const express = require('express')
const jira = require('./jira')
const app = express()
const server = require('http').createServer(app)
var bodyParser = require('body-parser')

app.use(bodyParser.json())
app.use(express.static(`${__dirname}/../../public`))

app.get('/search', (req, res) => {
  const { username, protocol, password, host, version, jql } = req.query || {}
  jira.setup(cfg.username || username, cfg.password || password, cfg.host || host, cfg.protocol || protocol, cfg.apiVersion || version)
  jira.search(jql).pipe(res)
})

app.get('/worklog/:id', (req, res) => {
  const { username, protocol, password, host, version } = req.query || {}
  const { id } = req.params || {}
  jira.setup(cfg.username || username, cfg.password || password, cfg.host || host, cfg.protocol || protocol, cfg.apiVersion || version)
  jira.worklog(id).pipe(res)
})

app.post('/worklog/:id', (req, res) => {
  const { username, protocol, password, host, version } = req.query || {}
  const { id } = req.params || {}
  const { body } = req
  jira.setup(cfg.username || username, cfg.password || password, cfg.host || host, cfg.protocol || protocol, cfg.apiVersion || version)
  jira.createWorklog(id, body).pipe(res)
})

server.listen(5000, () => {
  console.log('Listening on %d', server.address().port)
  if (!process.env.IS_DEV) {
    open(`http://localhost:${server.address().port}`)
  }
})

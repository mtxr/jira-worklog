#!/usr/bin/env node

const open = require('open')
const express = require('express')
const jira = require('./jira')
const app = express()
const server = require('http').createServer(app)
const bodyParser = require('body-parser')
const moment = require('moment')
const url = require('url')

app.use(bodyParser.json())
app.use(express.static(`${__dirname}/../../public`))

const getIssueWorklogs = (key, att = 3) => {
  if (att === 0) return Promise.reject(new Error(`Max attempts for issue ${key} reachead!`))

  return new Promise((resolve, reject) => {
    jira.worklog(key, (error, response, body) => {
      try {
        if (error) throw error
        const data = JSON.parse(body)
        data.key = key
        return resolve(data)
      } catch (er) {
        return reject(er)
      }
    })
  })
  .then((all) => {
    all.key = key
    return all
  })
  .catch(() => {
    console.log('retry ' + key)
    return getIssueWorklogs(key, att--)
  })
}

let reportCache = {}
let loggedDates = {}
function serializeReport () {
  let users = Object.keys(reportCache).sort((a, b) => a.localeCompare(b)).map((name) => reportCache[name])
  loggedDates = Object.keys(loggedDates).sort((a, b) => new Date(a) - new Date(b)).reduce((prev, dt) => { prev[dt] = loggedDates[dt]; return prev }, {})
  users = users.map((user) => {
    user.dates = Object.keys(loggedDates).sort((a, b) => new Date(a) - new Date(b)).map((date) => {
      user.dates[date] = user.dates[date] || {}
      return { date, spent: user.dates[date].spent || null, issues: user.dates[date].issues || {} }
    })
    return user
  })
  return { users, dates: loggedDates }
}

app.get('/report', (req, res) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.header('Pragma', 'no-cache')
  res.header('Expires', 0)

  const { task } = req.query || {}
  const start = moment().add(-6, 'days').format('YYYY-MM-DD')
  const end = moment().add(1, 'days').format('YYYY-MM-DD')
  if (!task && reportCache[`${start}${end}`]) {
    return res.json(reportCache[`${start}${end}`])
  }
  reportCache = reportCache || {}
  const jql = `(
    (
      worklogDate >= '${start}' AND worklogDate <= '${end}'
    ) OR (
      updated >= '${start}' AND updated <= '${end}'
    ) OR (
      created >= '${start}' AND created <= '${end}'
    )
  ) AND timespent >= 0 ${cfg.project ? 'AND project = ' + cfg.project : ''}`

  jira.search(jql, (error, response, body) => {
    try {
      if (error) throw error
      const data = JSON.parse(body)
      return Promise.all(data.issues.map((i) => getIssueWorklogs(i.key)))
      .then((issues) => {
        const startDate = moment(start)
        const loopDate = moment(start)
        const endDate = moment(end).endOf('day')
        while (loopDate.isBefore(endDate)) {
          loggedDates[loopDate.format('YYYY-MM-DD')] = 0
          loopDate.add(1, 'days')
        }
        issues.forEach((issue) => {
          issue.worklogs.forEach((wl) => {
            let worklogDate = moment(wl.started.substring(0, 10))
            if (worklogDate < startDate) return
            if (worklogDate > endDate) return
            worklogDate = worklogDate.format('YYYY-MM-DD')
            const author = wl.author.displayName
            reportCache[author] = reportCache[author] || { name: author, totalSpent: 0, avatar: wl.author.avatarUrls['24x24'], dates: {} }
            reportCache[author].dates[worklogDate] = reportCache[author].dates[worklogDate] || { spent: 0, issues: { } }
            reportCache[author].dates[worklogDate].issues[issue.key] = reportCache[author].dates[worklogDate].issues[issue.key] || 0
            reportCache[author].dates[worklogDate].issues[issue.key] += wl.timeSpentSeconds
            reportCache[author].dates[worklogDate].spent += wl.timeSpentSeconds
            reportCache[author].totalSpent += wl.timeSpentSeconds
            loggedDates[worklogDate] = loggedDates[worklogDate] || 0
            loggedDates[worklogDate] += wl.timeSpentSeconds
          })
        })
        return res.json(serializeReport())
      })
      .catch((er) => {
        console.error(er)
        return res.json({ error: er.message })
      })
    } catch (er) {
      console.error(er)
      res.statusCode = 400
      return res.json({ error: er.message })
    }
  })
})

const cfg = {}
app.post('/auth', (req, res) => {
  const { username, server, password, version, project } = req.body
  if (!(username && server && password)) {
    res.status(500)
    return res.json('Preencha o servidor, usuário e senha.')
  }
  const parsedUrl = url.parse(server)
  cfg.username = username
  cfg.password = password
  cfg.project = project
  cfg.version = version || 2
  cfg.protocol = parsedUrl.protocol
  cfg.host = parsedUrl.host
  jira.setup(cfg.username, cfg.password, cfg.host, cfg.protocol, cfg.apiVersion)
  const result = JSON.parse(JSON.stringify(cfg))
  delete result.password
  console.log(result)
  res.json(result)
})

app.get('/search', (req, res) => {
  const { jql } = req.query || {}
  jira.search(jql).pipe(res)
})

app.get('/worklog/:id', (req, res) => {
  const { id } = req.params || {}
  jira.worklog(id).pipe(res)
})

app.post('/worklog/:id', (req, res) => {
  const { id } = req.params || {}
  const { body } = req

  jira.createWorklog(id, body, (error, response, wl) => {
    try {
      if (error) throw error
      let worklogDate = moment(wl.started.substring(0, 10))
      worklogDate = worklogDate.format('YYYY-MM-DD')
      const author = wl.author.displayName
      reportCache[author] = reportCache[author] || { name: author, totalSpent: 0, avatar: wl.author.avatarUrls['24x24'], dates: {} }
      reportCache[author].dates[worklogDate] = reportCache[author].dates[worklogDate] || { spent: 0, issues: { } }
      reportCache[author].dates[worklogDate].issues[id] = reportCache[author].dates[worklogDate].issues[id] || 0
      reportCache[author].dates[worklogDate].issues[id] += wl.timeSpentSeconds
      reportCache[author].dates[worklogDate].spent += wl.timeSpentSeconds
      reportCache[author].totalSpent += wl.timeSpentSeconds
      return res.json(serializeReport())
    } catch (er) {
      console.error(er)
      res.statusCode = 400
      return res.json({ error: er.message })
    }
  })
})

server.listen(5000, () => {
  console.log('Listening on %d', server.address().port)
  if (!process.env.IS_DEV) {
    open(`http://localhost:${server.address().port}`)
  }
})

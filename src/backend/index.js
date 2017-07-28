#!/usr/bin/env node

const cfg = require('./config.json')
const open = require('open')
const express = require('express')
const jira = require('./jira')
const app = express()
const server = require('http').createServer(app)
const bodyParser = require('body-parser')
const moment = require('moment')

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
app.get('/report', (req, res) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.header('Pragma', 'no-cache')
  res.header('Expires', 0)

  const { username, protocol, password, host, version, project, task } = req.query || {}
  const start = moment().add(-6, 'days').format('YYYY-MM-DD')
  const end = moment().add(1, 'days').format('YYYY-MM-DD')
  if (!task && reportCache[`${start}${end}`]) {
    return res.json(reportCache[`${start}${end}`])
  }
  reportCache = {}
  const jql = `(worklogDate >= '${start}' OR updated >= '${start}' OR created >= '${start}') AND (worklogDate <= '${end}' OR updated <= '${end}' OR created <= '${end}') AND timespent > 0 ${project ? ' AND project = ' + project : ''}`
  jira.setup(cfg.username || username, cfg.password || password, cfg.host || host, cfg.protocol || protocol, cfg.apiVersion || version)
  jira.search(jql, (error, response, body) => {
    try {
      if (error) throw error
      const data = JSON.parse(body)
      return Promise.all(data.issues.map((i) => getIssueWorklogs(i.key)))
      .then((issues) => {
        let dates = {}
        const users = {}
        const startDate = moment(start)
        const loopDate = moment(start)
        const endDate = moment(end).endOf('day')
        while (loopDate.isBefore(endDate)) {
          dates[loopDate.format('YYYY-MM-DD')] = 0
          loopDate.add(1, 'days')
        }
        issues.forEach((issue) => {
          issue.worklogs.forEach((wl) => {
            let worklogDate = moment(wl.started.substring(0, 10))
            if (start !== null && end !== null) {
              if (worklogDate < startDate) return
              if (worklogDate > endDate) return
            }
            const author = wl.author.displayName
            worklogDate = worklogDate.format('YYYY-MM-DD')
            dates[worklogDate] = dates[worklogDate] || 0
            users[author] = users[author] || { name: wl.author.displayName, avatar: wl.author.avatarUrls['24x24'] }
            users[author].totalSpent = users[author].totalSpent || 0
            users[author]['dates'] = users[author]['dates'] || {}
            users[author]['dates'][worklogDate] = users[author]['dates'][worklogDate] || { issues: {}, spent: 0 }
            users[author]['dates'][worklogDate].spent += wl.timeSpentSeconds
            users[author]['dates'][worklogDate].issues[issue.key] = users[author]['dates'][worklogDate].issues[issue.key] || 0
            users[author]['dates'][worklogDate].issues[issue.key] += wl.timeSpentSeconds
            users[author].totalSpent += wl.timeSpentSeconds
            dates[worklogDate] += wl.timeSpentSeconds
          })
        })
        return Promise.all([
          Object.keys(dates).sort((a, b) => new Date(a) - new Date(b)).reduce((prev, dt) => { prev[dt] = dates[dt]; return prev }, {}),
          Object.keys(users).sort((a, b) => a.localeCompare(b)).map((name) => users[name])
        ])
      })
      .then(([dates, users]) => {
        const loggedDates = Object.keys(dates)
        users = users.map((user) => {
          user.dates = loggedDates.map((date) => {
            user.dates[date] = user.dates[date] || {}
            return { date, spent: user.dates[date].spent || null, issues: user.dates[date].issues || {} }
          })
          return user
        })
        return { users, dates }
      })
      .then((all) => {
        reportCache[`${start}${end}`] = all
        return res.json(all)
      })
      .catch((er) => {
        return res.json({ error: er.message })
      })
    } catch (er) {
      res.statusCode = 400
      return res.json({ error: er.message })
    }
  })
})

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

  jira.createWorklog(id, body, (error, response, body) => {
    try {
      if (error) throw error
      reportCache = {}
      return res.json(body)
    } catch (er) {
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

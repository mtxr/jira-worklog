const JiraApi = require('jira-client')
const open = require('open')
const moment = require('moment')

const usage = () => {
  console.log('Usage: \n\tnode index.js --start <date> --end <date> [--project <project>]\n\tnode index.js --jql "jira query"')
}
var argv = require('minimist')(process.argv.slice(2))
if (!((argv.start && argv.end) || argv.jql)) {
  usage()
  process.exit(1)
}

let searchQuery = argv.jql || `(worklogDate >= '${argv.start}' OR updated >= '${argv.start}' OR created >= '${argv.start}') AND (worklogDate <= '${argv.end}' OR updated <= '${argv.end}' OR created <= '${argv.end}') AND timespent > 0 ${argv.project ? ' AND project = ' + argv.project : ''}`
const startDate = argv.start ? moment(argv.start, 'YYYY-MM-DD').startOf('day') : null
const endDate = argv.end ? moment(argv.end, 'YYYY-MM-DD').endOf('day') : null

console.log('Searching for:')
console.log(searchQuery)

const jira = new JiraApi(require('./config.json'))

const getIssues = () => {
  return jira.searchJira(searchQuery, { fields: ['key', 'name'], maxResults: 50000 })
  .then((results) => results.issues)
  .catch((error) => Promise.reject(error))
}

const getIssueWorklogs = (key, att = 3) => {
  if (att === 0) return Promise.reject(new Error(`Max attempts for issue ${key} reachead!`))

  return jira.doRequest(jira.makeRequestHeader(jira.makeUri({ pathname: `/issue/${key}/worklog` })))
  .then((all) => {
    all.key = key
    return all
  })
  .catch(() => {
    console.log('retry ' + key)
    return getIssueWorklogs(key, att--)
  })
}

getIssues()
.then((all) => {
  console.log(`Found ${all.length} issues`)
  return all.sort((a, b) => parseInt(a.key.substring(7)) - parseInt(b.key.substring(7)))
})
.then((issues) => Promise.all(issues.map((issue) => getIssueWorklogs(issue.key))))
.then((issues) => {
  let result = {}
  const users = {}
  issues.forEach((issue) => {
    issue.worklogs.forEach((wl) => {
      let worklogDate = moment(wl.started.substring(0, 10))
      if (argv.start !== null && argv.end !== null) {
        if (worklogDate < startDate) return
        if (worklogDate > endDate) return
      }
      const author = wl.author.displayName
      worklogDate = worklogDate.format('YYYY-MM-DD')
      users[author] = users[author] || wl.author
      result[worklogDate] = result[worklogDate] || { date: worklogDate, authors: {}, total: 0 }
      result[worklogDate]['authors'][author] = result[worklogDate]['authors'][author] || { spent: 0, issues: [] }
      result[worklogDate]['authors'][author].spent += wl.timeSpentSeconds
      result[worklogDate]['authors'][author].issues.push(issue)
      result[worklogDate]['total'] += wl.timeSpentSeconds
    })
  })
  return Promise.all([
    Object.keys(result).map((date) => result[date]).sort((a, b) => new Date(a.date) - new Date(b.date)),
    Object.keys(users).map((d) => users[d]).sort((a, b) => a.displayName.localeCompare(b.displayName))
  ])
})
.then(([worklogs, users]) => {
  let table = '<table>'
  table += '<thead><tr><th>Author</th>'
  const dates = []

  worklogs.forEach((dateLog) => {
    if (dates.indexOf(dateLog.date) !== -1) return
    dates.push(dateLog.date)
    table += `<th>${moment(dateLog.date).format('DD/MM')}</th>`
  })
  table += '<th>Total</th></tr></thead><tbody>'
  users.forEach((author) => {
    const authorNames = author.displayName.split(' ')
    const displayNameFormated = authorNames[0] + (authorNames.length >= 2 ? ` ${authorNames.pop()}` : '')
    let line = `<td><img src="${author.avatarUrls['16x16']}"/> ${displayNameFormated}</td>`
    let total = 0
    worklogs.forEach((wl) => {
      let spentTime = wl.authors[author.displayName] ? (wl.authors[author.displayName].spent / 3600) : 0
      total += spentTime
      spentTime = spentTime >= 8.0 ? `<b>${spentTime.toFixed(2)}</b>` : ((spentTime ? spentTime.toFixed(2) : null) || '')
      line += `<td>${spentTime}</td>`
    })
    line += `<td>${total.toFixed(2)}</td>`
    table += `<tr>${line}</tr>`
  })
  table += '</tbody></table>'
  return `<html>
    <head>
    <style>
    body {font-family: sans-serif;}
    img { width: 16px; height: 16px; }
    table { border-collapse: collapse; }
    th, td { border-bottom: 1px solid #999; padding: 3px }
    </style>
    </head>
    <body>
      ${table}
    </body>
  </html>`
})
.then((content) => {
  require('fs').writeFileSync('./report.html', content)
  return './report.html'
})
.then((report) => {
  open(report)
})
.catch((error) => {
  console.error(error)
  return Promise.reject(error)
})

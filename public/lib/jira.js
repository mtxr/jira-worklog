console.log('Jira loaded!')
var $ = window.$ || window.jQuery
var localServer = 'http://localhost:5000'

$.ajax({
  url: `${localServer}/search`,
  data: {
    jql: '(worklogDate >= \'2017-07-01\' OR updated >= \'2017-07-01\' OR created >= \'2017-07-01\') AND (worklogDate <= \'2017-07-30\' OR updated <= \'2017-07-30\' OR created <= \'2017-07-30\') AND timespent > 0  AND project = SDMIBM',
    fields: [ 'key', 'name' ],
    maxResults: 50000
  },
  success: function (data) {
    console.log('Response', data)
  },
  crossDomain: true,
  dataType: 'json'
})

// {
//   auth: { user: 'xb188516', pass: 'Eric001' },
//   rejectUnauthorized: false,
//   method: 'POST',
//   uri: 'https://jira.ci.gsnet.corp/rest/api/2/search',
//   json: true,
//   followAllRedirects: true,
//   body:
//    { jql: '(worklogDate >= \'2017-07-01\' OR updated >= \'2017-07-01\' OR created >= \'2017-07-01\') AND (worklogDate <= \'2017-07-30\' OR updated <= \'2017-07-30\' OR created <= \'2017-07-30\') AND timespent > 0  AND project = SDMIBM',
//      fields: [ 'key', 'name' ],
//      maxResults: 50000 },
//   callback: [Function: RP$callback],
//   transform: undefined,
//   simple: true,
//   resolveWithFullResponse: false,
//   transform2xxOnly: false }

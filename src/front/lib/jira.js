import * as $ from 'jquery'

const localServer = 'http://localhost:5000'

function getIssues () {
  return $.ajax({
    url: `${localServer}/search`,
    data: {
      jql: '',
      fields: [ 'key', 'name' ],
      maxResults: 50000
    },
    crossDomain: true,
    dataType: 'json'
  })
}

export { getIssues }

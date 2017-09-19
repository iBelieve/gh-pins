const url = require('url')
const qs = require('querystring')
const fetch = require('node-fetch')
const { send } = require('micro')

const client = require('graphql-client')({
  url: 'https://api.github.com/graphql',
  headers: {
    Authorization: 'Bearer ' + process.env.GITHUB_TOKEN
  }
})

const cache = require('lru-cache')({
  max: 1024 * 1024,
  maxAge: 86400 * 30
})

const HOME_PAGE = `
  <head>
    <meta charset="utf-8" />
    <title>GitHub Pinned Repos API</title>
  </head>
  <style>body {font-family: Helvetica, serif;margin: 30px;}</style>
  <p>GET /?username=GITHUB_USERNAME</p>
  <p>
    <form action="/">
      <input type="text" name="username" placeholder="username" />
      <button type="submit">Go!</button>
    </form>
  </p>
  <p>
    Made by <a href="https://github.com/iBelieve">iBelieve</a> ·
    GraphQL version of <a href="https://github.com/egoist/gh-pinned-repos">egoist/gh-pinned-repos</a> ·
    <a href="https://github.com/iBelieve/gh-pins">Source code</a>
  </p>
`

function getPinnedRepos(username) {
  return client
    .query(
      `
        query ($username: String!) {
          repositoryOwner(login: $username) {
            ... on User {
              pinnedRepositories(first:6) {
                edges {
                  node {
                    name
                    primaryLanguage {
                      name
                    }
                    stargazers {
                      totalCount
                    }
                  }
                }
              }
            }
          }
        }
      `,
      { username }
    )
    .then(json =>
      json.data.repositoryOwner.pinnedRepositories.edges.map(edge => edge.node).map(repo => ({
        ...repo,
        primaryLanguage: undefined,
        language: repo.primaryLanguage.name,
        stargazers: undefined,
        stars: repo.stargazers.totalCount
      }))
    )
}

module.exports = async (req, res) => {
  /* allow cors from any origin */
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Request-Method', '*')
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    return
  }

  const { pathname, query } = url.parse(req.url)
  const { username, refresh } = qs.parse(query)

  if (pathname === '/favicon.ico') {
    return send(res, 404, '')
  } else if (username) {
    let result = cache.get(username)

    if (!result || refresh) {
      result = await getPinnedRepos(username)
      cache.set(username, result)
    }

    return result
  } else {
    res.setHeader('Content-Type', 'text/html')
    return HOME_PAGE
  }
}

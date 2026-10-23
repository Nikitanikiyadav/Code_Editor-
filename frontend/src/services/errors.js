// Django usually sends JSON errors:
//   { detail: "Invalid username or password." }
//   { username: ["A user with that username already exists."] }
// But when the server crashes or rejects a request before DRF sees it,
// it sends an HTML page (a string). We must not loop over that string.
export function getErrorMessages(error) {
  const response = error?.response
  if (!response) return ['Cannot reach the server. Is Django running?']

  const data = response.data
  const status = response.status

  // HTML or plain text instead of JSON
  if (typeof data === 'string') {
    if (status === 403) {
      return ['Request blocked (403). Refresh the page and try again.']
    }
    if (status >= 500) {
      return [`Server error (${status}). Check the Django terminal for details.`]
    }
    return [`Unexpected response from server (${status}).`]
  }

  if (data && typeof data.detail === 'string') return [data.detail]

  const messages = []
  if (data && typeof data === 'object') {
    for (const [field, value] of Object.entries(data)) {
      const list = Array.isArray(value) ? value : [value]
      list.forEach((msg) => messages.push(`${field}: ${msg}`))
    }
  }
  return messages.length ? messages : ['Something went wrong.']
}
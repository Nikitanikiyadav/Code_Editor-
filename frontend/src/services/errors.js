// Django sends errors in different shapes:
//   { detail: "Invalid username or password." }
//   { username: ["A user with that username already exists."], password: [...] }
// This function turns any of them into a list of readable strings.
export function getErrorMessages(error) {
  const data = error?.response?.data
  if (!data) return ['Cannot reach the server. Please try again.']
  if (typeof data.detail === 'string') return [data.detail]

  const messages = []
  for (const [field, value] of Object.entries(data)) {
    const list = Array.isArray(value) ? value : [value]
    list.forEach((msg) => messages.push(`${field}: ${msg}`))
  }
  return messages.length ? messages : ['Something went wrong.']
}
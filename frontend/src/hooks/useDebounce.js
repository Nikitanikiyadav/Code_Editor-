import { useEffect, useState } from 'react'

// Returns `value` only after it has stopped changing for `delay` ms.
// Used so we don't call the API on every single keystroke in the search box.
export default function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer) // cancel if the value changes again
  }, [value, delay])

  return debounced
}
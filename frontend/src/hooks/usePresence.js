import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const LEAVE_DELAY_MS = 3000 // wait before saying "left" (people switch files)

export default function usePresence(me, toast) {
  const [conns, setConns] = useState({}) // connectionId -> { id, username }
  const connsRef = useRef({})            // same data, readable inside callbacks
  const leaveTimers = useRef(new Map())  // userId -> timeout

  const commit = useCallback((next) => {
    connsRef.current = next
    setConns(next)
  }, [])

  // Forget everything. Called whenever a socket opens or closes;
  // the server then re-sends who is online.
  const reset = useCallback(() => {
    leaveTimers.current.forEach(clearTimeout)
    leaveTimers.current.clear()
    commit({})
  }, [commit])

  const handleEvent = useCallback(
    (event) => {
      const current = connsRef.current

      if (event.type === 'presence_here' || event.type === 'presence_join') {
        const user = event.user
        const alreadyHere = Object.values(current).some((u) => u.id === user.id)
        const pendingLeave = leaveTimers.current.get(user.id)
        if (pendingLeave) {
          // They only switched files: cancel the "left" toast, show no "joined"
          clearTimeout(pendingLeave)
          leaveTimers.current.delete(user.id)
        }
        commit({ ...current, [event.conn]: user })
        if (
          event.type === 'presence_join' &&
          !alreadyHere && !pendingLeave && user.id !== me.id
        ) {
          toast.info(`${user.username} joined`)
        }
      } else if (event.type === 'presence_leave') {
        const user = current[event.conn]
        if (!user) return
        const next = { ...current }
        delete next[event.conn]
        commit(next)

        const stillHere = Object.values(next).some((u) => u.id === user.id)
        if (!stillHere && user.id !== me.id) {
          clearTimeout(leaveTimers.current.get(user.id))
          leaveTimers.current.set(
            user.id,
            setTimeout(() => {
              leaveTimers.current.delete(user.id)
              toast.info(`${user.username} left`)
            }, LEAVE_DELAY_MS),
          )
        }
      }
    },
    [commit, me.id, toast],
  )

  useEffect(() => {
    const timers = leaveTimers.current
    return () => timers.forEach(clearTimeout)
  }, [])

  // One entry per person (someone with two tabs counts once). I'm always listed.
  const users = useMemo(() => {
    const byId = new Map()
    byId.set(me.id, { id: me.id, username: me.username, you: true })
    Object.values(conns).forEach((u) => {
      if (!byId.has(u.id)) byId.set(u.id, u)
    })
    return Array.from(byId.values())
  }, [conns, me.id, me.username])

  return { users, handleEvent, reset }
}
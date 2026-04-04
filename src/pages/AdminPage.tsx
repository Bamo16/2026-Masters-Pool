import { useState } from 'react'

const GREEN = '#006747'
const GREEN_LIGHT = '#e6f2ee'
const GREEN_DARK = '#004f35'
const GOLD = '#f0c040'

interface EntryRow {
  id: number
  participant_name: string
  email: string
  submitted_at: string
  paid: boolean
  picks: { tier: number; player_name: string }[]
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authedPassword, setAuthedPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<EntryRow[] | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.status === 401) {
        setError('Incorrect password.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      const data: EntryRow[] = await res.json()
      setAuthedPassword(password)
      setEntries(data)
    } catch {
      setError('Network error. Please try again.')
    }

    setLoading(false)
  }

  async function handleTogglePaid(entry: EntryRow) {
    const newPaid = !entry.paid
    // Optimistic update
    setEntries(prev => prev!.map(e => e.id === entry.id ? { ...e, paid: newPaid } : e))
    setRowError(null)

    try {
      const res = await fetch('/api/admin-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, paid: newPaid, password: authedPassword }),
      })

      if (!res.ok) {
        // Revert on failure
        setEntries(prev => prev!.map(e => e.id === entry.id ? { ...e, paid: entry.paid } : e))
        setRowError(`Failed to update paid status for ${entry.participant_name}.`)
      }
    } catch {
      setEntries(prev => prev!.map(e => e.id === entry.id ? { ...e, paid: entry.paid } : e))
      setRowError(`Network error updating ${entry.participant_name}.`)
    }
  }

  async function handleDelete(entry: EntryRow) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${entry.participant_name}'s entry? This cannot be undone.`
    )
    if (!confirmed) return

    setRowError(null)

    try {
      const res = await fetch('/api/admin-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, password: authedPassword }),
      })

      if (res.ok) {
        setEntries(prev => prev!.filter(e => e.id !== entry.id))
      } else {
        setRowError(`Failed to delete ${entry.participant_name}'s entry.`)
      }
    } catch {
      setRowError(`Network error deleting ${entry.participant_name}'s entry.`)
    }
  }

  if (entries === null) {
    return (
      <div style={styles.gatePage}>
        <div style={styles.gateCard}>
          <h1 style={styles.gateHeading}>Masters Pool Admin</h1>
          <form onSubmit={handleSignIn} style={styles.gateForm}>
            <input type="hidden" name="username" value="admin" autoComplete="username" />
            <label style={styles.gateLabel}>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={styles.gateInput}
                required
              />
            </label>
            {error && <div style={styles.gateError}>{error}</div>}
            <button
              type="submit"
              disabled={loading || password.length === 0}
              style={{
                ...styles.gateBtn,
                opacity: loading || password.length === 0 ? 0.6 : 1,
                cursor: loading || password.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const totalEntries = entries.length
  const paidCount = entries.filter(e => e.paid).length

  function picksByTier(picks: EntryRow['picks']): Record<number, string[]> {
    const grouped: Record<number, string[]> = {}
    for (const pick of picks) {
      if (!grouped[pick.tier]) grouped[pick.tier] = []
      grouped[pick.tier].push(pick.player_name)
    }
    return grouped
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerGoldBar} />
        <h1 style={styles.title}>2026 Masters Pool</h1>
        <p style={styles.subtitle}>Admin Dashboard</p>
        <div style={styles.headerGoldBar} />
      </header>

      <div style={styles.content}>
        {/* Summary */}
        <div style={styles.summaryRow}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryNumber}>{totalEntries}</div>
            <div style={styles.summaryLabel}>Total Entries</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={{ ...styles.summaryNumber, color: GREEN }}>{paidCount}</div>
            <div style={styles.summaryLabel}>Paid</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={{ ...styles.summaryNumber, color: '#c00' }}>{totalEntries - paidCount}</div>
            <div style={styles.summaryLabel}>Unpaid</div>
          </div>
        </div>

        {rowError && <div style={styles.rowErrorBox}>{rowError}</div>}

        {/* Table */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Submitted</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Paid</th>
                <th style={styles.th}>Picks</th>
                <th style={{ ...styles.th, textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const tiers = picksByTier(entry.picks)
                return (
                  <tr
                    key={entry.id}
                    style={{ background: i % 2 === 0 ? '#fff' : '#f7fbf9' }}
                  >
                    <td style={styles.td}>{entry.participant_name}</td>
                    <td style={{ ...styles.td, color: '#555', fontSize: 13 }}>{entry.email}</td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap', fontSize: 13, color: '#666' }}>
                      {formatDate(entry.submitted_at)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={entry.paid}
                        onChange={() => handleTogglePaid(entry)}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </td>
                    <td style={{ ...styles.td, minWidth: 220 }}>
                      {[1, 2, 3, 4, 5, 6].map(tier => {
                        const names = tiers[tier]
                        if (!names?.length) return null
                        return (
                          <div key={tier} style={styles.pickLine}>
                            <span style={styles.pickTierBadge}>T{tier}</span>
                            {names.join(', ')}
                          </div>
                        )
                      })}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center', verticalAlign: 'middle' }}>
                      <button
                        onClick={() => handleDelete(entry)}
                        style={styles.deleteBtn}
                        title={`Delete ${entry.participant_name}'s entry`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  // Password gate
  gatePage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: GREEN_LIGHT,
    padding: 16,
  },
  gateCard: {
    background: '#fff',
    borderRadius: 14,
    padding: '40px 36px',
    boxShadow: '0 4px 24px rgba(0,103,71,0.15)',
    width: '100%',
    maxWidth: 360,
  },
  gateHeading: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 22,
    fontWeight: 700,
    color: GREEN,
    margin: '0 0 28px',
    textAlign: 'center',
  },
  gateForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  gateLabel: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 14,
    fontWeight: 500,
    color: '#444',
    gap: 6,
  },
  gateInput: {
    height: 48,
    padding: '0 14px',
    fontSize: 16,
    border: '1.5px solid #ccc',
    borderRadius: 8,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    background: '#fff',
    color: '#1a1a1a',
    colorScheme: 'light',
  },
  gateError: {
    background: '#fff0f0',
    border: '1px solid #ffcccc',
    color: '#c00',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
  },
  gateBtn: {
    height: 48,
    border: 'none',
    borderRadius: 8,
    background: GREEN,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    transition: 'opacity 0.2s',
  },

  // Dashboard
  page: {
    minHeight: '100vh',
    background: '#f4f7f5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a1a1a',
  },
  header: {
    background: `linear-gradient(175deg, #007a54 0%, ${GREEN} 60%, #004f35 100%)`,
    color: '#fff',
    padding: '28px 20px',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0, 103, 71, 0.4)',
  },
  headerGoldBar: {
    height: 2,
    background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
    borderRadius: 2,
    margin: '0 32px',
  },
  title: {
    margin: '12px 0 6px',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '0.5px',
    color: '#fff',
    fontFamily: "Georgia, 'Times New Roman', serif",
    textShadow: '0 1px 3px rgba(0,0,0,0.25)',
  },
  subtitle: {
    margin: '0 0 12px',
    fontSize: 14,
    opacity: 0.8,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },
  content: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '28px 16px 60px',
  },
  summaryRow: {
    display: 'flex',
    gap: 16,
    marginBottom: 28,
    flexWrap: 'wrap' as const,
  },
  summaryCard: {
    background: '#fff',
    border: '1px solid #d4e8df',
    borderRadius: 10,
    padding: '18px 28px',
    textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    minWidth: 100,
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: 700,
    color: '#1a1a1a',
    lineHeight: 1,
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    color: '#888',
  },
  rowErrorBox: {
    background: '#fff0f0',
    border: '1px solid #ffcccc',
    color: '#c00',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },
  tableWrapper: {
    background: '#fff',
    border: '1px solid #d4e8df',
    borderRadius: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    background: GREEN_DARK,
    color: '#fff',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    padding: '12px 14px',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #eef3f1',
    verticalAlign: 'top' as const,
    lineHeight: 1.5,
  },
  pickLine: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 3,
    fontSize: 13,
    color: '#333',
  },
  pickTierBadge: {
    background: GREEN_LIGHT,
    color: GREEN_DARK,
    fontWeight: 700,
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 4,
    flexShrink: 0,
  },
  deleteBtn: {
    background: 'none',
    border: '1px solid #ffaaaa',
    color: '#c00',
    borderRadius: 6,
    width: 28,
    height: 28,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

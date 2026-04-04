import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Player } from '../types'

const DEADLINE = '2026-04-09T04:59:00.000Z' // April 8, 2026 11:59 PM CT

const TIER_PICKS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 3,
  5: 3,
  6: 3,
}
const TOTAL_PICKS = Object.values(TIER_PICKS).reduce((a, b) => a + b, 0) // 15


const TIER_COLORS: Record<number, string> = {
  1: '#fffde7',
  2: '#e8f5e9',
  3: '#e3f2fd',
  4: '#fce4ec',
  5: '#f3e5f5',
  6: '#efebe9',
}

const GREEN = '#006747'
const GREEN_LIGHT = '#e6f2ee'
const GREEN_DARK = '#004f35'
const GOLD = '#f0c040'



export default function EntryForm() {
  const [playersByTier, setPlayersByTier] = useState<Record<number, Player[]>>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [picks, setPicks] = useState<Record<number, string[]>>(() => {
    const init: Record<number, string[]> = {}
    for (const [tier, count] of Object.entries(TIER_PICKS)) {
      init[Number(tier)] = Array(count).fill('')
    }
    return init
  })

  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedPicksByTier, setSubmittedPicksByTier] = useState<Record<number, Player[]>>({})

  useEffect(() => {
    async function fetchPlayers() {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('world_rank', { ascending: true })

      if (error) {
        setFetchError('Failed to load players. Please refresh.')
        setLoading(false)
        return
      }

      const grouped: Record<number, Player[]> = {}
      for (const player of data as Player[]) {
        if (!grouped[player.tier]) grouped[player.tier] = []
        grouped[player.tier].push(player)
      }
      setPlayersByTier(grouped)
      setLoading(false)
    }
    fetchPlayers()
  }, [])

  const allSelectedPlayerIds = Object.values(picks).flat().filter(Boolean)
  const picksCount = allSelectedPlayerIds.length

  function handlePickChange(tier: number, slotIndex: number, playerId: string) {
    setPicks(prev => {
      const tierPicks = [...prev[tier]]
      tierPicks[slotIndex] = playerId
      return { ...prev, [tier]: tierPicks }
    })
  }

  const isFormValid =
    name.trim() !== '' &&
    email.trim() !== '' &&
    picksCount === TOTAL_PICKS

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isFormValid) return

    setSubmitting(true)
    setSubmitError(null)

    const { data: entryData, error: entryError } = await supabase
      .from('entries')
      .insert({ participant_name: name.trim(), email: email.trim() })
      .select('id')
      .single()

    if (entryError || !entryData) {
      const isDuplicate =
        entryError?.code === '23505' ||
        entryError?.message?.toLowerCase().includes('unique')
      setSubmitError(
        isDuplicate
          ? 'An entry with this email address already exists. If you need to make changes, please contact Bob directly.'
          : 'Something went wrong. Please try again or contact Bob directly.'
      )
      setSubmitting(false)
      return
    }

    const entryId = entryData.id

    const picksToInsert = Object.entries(picks).flatMap(([tier, slots]) =>
      slots.filter(Boolean).map(playerId => ({
        entry_id: entryId,
        tier: Number(tier),
        player_id: playerId,
      }))
    )

    const { error: picksError } = await supabase.from('picks').insert(picksToInsert)

    if (picksError) {
      setSubmitError('Entry saved but picks failed. Please contact the pool admin.')
      setSubmitting(false)
      return
    }

    // Build a lookup of all players by their string ID
    const allPlayers: Record<string, Player> = {}
    for (const players of Object.values(playersByTier)) {
      for (const p of players) {
        allPlayers[String(p.id)] = p
      }
    }

    // Store full player objects grouped by tier for the success screen
    const byTier: Record<number, Player[]> = {}
    for (const [tierStr, slots] of Object.entries(picks)) {
      const tier = Number(tierStr)
      byTier[tier] = slots.filter(Boolean).map(id => allPlayers[id]).filter(Boolean)
    }
    setSubmittedPicksByTier(byTier)

    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={{ color: GREEN }}>Loading players...</p>
      </div>
    )
  }

  if (fetchError) {
    return <div style={styles.errorBox}>{fetchError}</div>
  }

  // Deadline check
  if (new Date() > new Date(DEADLINE)) {
    return (
      <div style={styles.page}>
        <header style={styles.header}>
          <div style={styles.headerGoldBar} />
          <h1 style={styles.title}>2026 Masters Pool</h1>
          <p style={styles.subtitle}>Pick 15 golfers across 6 tiers</p>
          <div style={styles.headerGoldBar} />
        </header>
        <div style={styles.centered}>
          <div style={styles.closedBox}>
            <h2 style={styles.closedHeading}>Submissions Closed</h2>
            <p style={styles.closedText}>
              Submissions for the 2026 Masters Pool are now closed. The tournament begins April 9th — good luck to all participants!
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={styles.page}>
        <header style={styles.header}>
          <div style={styles.headerGoldBar} />
          <h1 style={styles.title}>2026 Masters Pool</h1>
          <p style={styles.subtitle}>Pick 15 golfers across 6 tiers</p>
          <div style={styles.headerGoldBar} />
        </header>
        <div style={styles.successBox}>
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ marginBottom: 16 }}>
            <circle cx="32" cy="32" r="32" fill={GREEN} />
            <path d="M18 32l10 10 18-18" stroke={GOLD} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <h2 style={styles.successHeading}>Entry Submitted!</h2>
          <p style={styles.successSubtext}>
            Thanks, <strong>{name}</strong> — your picks are locked in for the 2026 Masters.
          </p>

          {/* Picks summary */}
          <div style={styles.picksSection}>
            {[1, 2, 3, 4, 5, 6].map(tier => {
              const players = submittedPicksByTier[tier] ?? []
              if (players.length === 0) return null
              return (
                <div
                  key={tier}
                  style={{ ...styles.picksTier, background: TIER_COLORS[tier] }}
                >
                  <div style={styles.picksTierHeader}>
                    <span style={styles.picksTierLabel}>Tier {tier}</span>
                  </div>
                  {players.map(p => (
                    <div key={p.id} style={styles.picksPlayer}>{p.name}</div>
                  ))}
                </div>
              )
            })}
          </div>

          <div style={styles.venmoBox}>
            <p style={styles.venmoTitle}>Pool Fee</p>
            <p style={styles.venmoText}>
              If you have a Venmo account and would like to submit your <strong>$20</strong> pool fee at this time, that would be appreciated — simply click the button below. Otherwise, feel free to pay Bob directly.
            </p>
            <a
              href="https://venmo.com/Robert-Biernbaum"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.venmoBtn}
            >
              Pay $20 on Venmo
            </a>
          </div>
        </div>
      </div>
    )
  }

  const emailInvalid = emailTouched && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerGoldBar} />
        <h1 style={styles.title}>2026 Masters Pool</h1>
        <p style={styles.subtitle}>Pick 15 golfers across 6 tiers</p>
        <div style={styles.headerGoldBar} />
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* How it works */}
        <div style={styles.howItWorksWrapper}>
          <button
            type="button"
            onClick={() => setHowItWorksOpen(o => !o)}
            style={styles.howItWorksToggle}
          >
            How it works {howItWorksOpen ? '▴' : '▾'}
          </button>
          {howItWorksOpen && (
            <ul style={styles.howItWorksList}>
              <li>Select 15 golfers across 6 tiers using the Official World Golf Ranking</li>
              <li>Tier 1 (ranked 1–5): pick 1 &nbsp;|&nbsp; Tier 2 (ranked 6–15): pick 2 &nbsp;|&nbsp; Tiers 3–6: pick 3 each</li>
              <li>Points are awarded each round based on leaderboard position — later rounds are worth more</li>
              <li>Golfers who miss the cut receive no points for rounds not played</li>
              <li>Tiebreaker: most points from your Tier 1 pick wins, then Tier 2, and so on</li>
            </ul>
          )}
        </div>

        {/* Progress */}
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(picksCount / TOTAL_PICKS) * 100}%`,
              background: picksCount === TOTAL_PICKS ? GOLD : GREEN,
            }}
          />
        </div>
        <p style={styles.progressLabel}>
          {picksCount} of {TOTAL_PICKS} picks selected
        </p>

        {/* Name & Email */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Your Info</h2>
          <label style={styles.label}>
            Name
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              style={styles.input}
              required
            />
          </label>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              style={{ ...styles.input, borderColor: emailInvalid ? '#c00' : '#ccc' }}
              required
            />
            {emailInvalid && (
              <span style={{ color: '#c00', fontSize: 13 }}>Enter a valid email address.</span>
            )}
          </label>
        </section>

        {/* Tier sections */}
        {[1, 2, 3, 4, 5, 6].map(tier => {
          const players = playersByTier[tier] ?? []
          const slotCount = TIER_PICKS[tier]
          const tierFilled = picks[tier].filter(Boolean).length
          const tierComplete = tierFilled === slotCount

          let badgeBg = '#e8e8e8'
          let badgeColor = '#999'
          if (tierFilled > 0 && !tierComplete) { badgeBg = '#f5a623'; badgeColor = '#7a4a00' }
          if (tierComplete) { badgeBg = GOLD; badgeColor = '#5a3a00' }

          return (
            <section
              key={tier}
              style={{
                ...styles.section,
                border: tierComplete
                  ? `2px solid ${GREEN}`
                  : '1px solid #d4e8df',
                background: tierComplete ? '#f0faf5' : '#fff',
              }}
            >
              <h2 style={styles.sectionTitle}>
                {tierComplete && <span style={styles.checkmark}>✓</span>}
                Tier {tier}
                <span style={{ ...styles.tierBadge, background: badgeBg, color: badgeColor }}>
                  {tierFilled} of {slotCount}
                </span>
              </h2>
              {Array.from({ length: slotCount }).map((_, slotIndex) => {
                const currentValue = picks[tier][slotIndex]
                return (
                  <label key={slotIndex} style={styles.label}>
                    Pick {slotIndex + 1}
                    <select
                      value={currentValue}
                      onChange={e => handlePickChange(tier, slotIndex, e.target.value)}
                      style={styles.select}
                    >
                      <option value="">— Select a player —</option>
                      {players.map(player => {
                        const playerId = String(player.id)
                        const isDisabled =
                          allSelectedPlayerIds.includes(playerId) && playerId !== currentValue
                        return (
                          <option key={player.id} value={playerId} disabled={isDisabled}>
                            {player.name}
                            {player.world_rank ? ` (WR #${player.world_rank})` : ''}
                            {isDisabled ? ' ✓' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                )
              })}
            </section>
          )
        })}

        {submitError && <div style={styles.errorBox}>{submitError}</div>}

        <button
          type="submit"
          disabled={!isFormValid || submitting}
          style={{
            ...styles.submitBtn,
            background: isFormValid ? GREEN : '#b0b0b0',
            color: '#fff',
            opacity: submitting ? 0.7 : 1,
            cursor: isFormValid && !submitting ? 'pointer' : 'not-allowed',
            animation: isFormValid && !submitting ? 'pulseGlow 2s ease-in-out infinite' : 'none',
          }}
        >
          {submitting ? 'Submitting...' : `Submit Entry (${picksCount}/${TOTAL_PICKS})`}
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '0 0 40px',
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
  form: {
    padding: '0 16px',
  },
  howItWorksWrapper: {
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 8,
    border: `1px solid #d4e8df`,
    background: '#f5faf7',
    overflow: 'hidden',
  },
  howItWorksToggle: {
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '10px 14px',
    textAlign: 'left' as const,
    fontSize: 13,
    fontWeight: 600,
    color: GREEN,
    cursor: 'pointer',
    letterSpacing: '0.2px',
  },
  howItWorksList: {
    margin: 0,
    padding: '0 16px 12px 28px',
    fontSize: 12,
    color: '#555',
    lineHeight: 1.65,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  progressBar: {
    height: 8,
    background: '#ddd',
    borderRadius: 4,
    margin: '20px 0 6px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease, background 0.3s ease',
  },
  progressLabel: {
    textAlign: 'center',
    fontSize: 13,
    color: '#666',
    margin: '0 0 20px',
  },
  section: {
    borderRadius: 10,
    padding: '16px 18px',
    marginBottom: 14,
    transition: 'border 0.2s, background 0.2s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  sectionTitle: {
    margin: '0 0 14px',
    fontSize: 15,
    fontWeight: 700,
    color: GREEN,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    letterSpacing: '0.3px',
    textTransform: 'uppercase' as const,
  },
  checkmark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    background: GREEN,
    color: '#fff',
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  tierBadge: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 12,
    fontWeight: 600,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 14,
    fontWeight: 500,
    color: '#444',
    marginBottom: 12,
    gap: 4,
  },
  input: {
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
  select: {
    height: 48,
    padding: '0 14px',
    fontSize: 16,
    border: '1.5px solid #ccc',
    borderRadius: 8,
    background: '#fff',
    color: '#1a1a1a',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    appearance: 'auto',
    colorScheme: 'light',
  },
  submitBtn: {
    display: 'block',
    width: '100%',
    height: 54,
    border: 'none',
    borderRadius: 10,
    fontSize: 17,
    fontWeight: 700,
    marginTop: 8,
    transition: 'background 0.3s, color 0.3s, opacity 0.2s',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    gap: 12,
  },
  spinner: {
    width: 36,
    height: 36,
    border: `4px solid ${GREEN_LIGHT}`,
    borderTop: `4px solid ${GREEN}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: '#fff0f0',
    border: '1px solid #ffcccc',
    color: '#c00',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 16,
    fontSize: 14,
  },
  successBox: {
    maxWidth: 480,
    margin: '40px auto',
    padding: '36px 28px',
    textAlign: 'center',
    background: '#fff',
    border: `1px solid #c8e0d5`,
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0, 103, 71, 0.12)',
  },
  successHeading: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 26,
    fontWeight: 700,
    color: GREEN,
    margin: '0 0 10px',
  },
  successSubtext: {
    fontSize: 15,
    color: '#555',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  picksSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    marginBottom: 24,
    textAlign: 'left' as const,
  },
  picksTier: {
    borderRadius: 8,
    padding: '10px 14px',
    border: '1px solid rgba(0,0,0,0.07)',
  },
  picksTierHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  picksTierLabel: {
    fontWeight: 700,
    fontSize: 13,
    color: GREEN_DARK,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
  },

  picksPlayer: {
    fontSize: 14,
    color: '#2a2a2a',
    paddingLeft: 4,
    lineHeight: 1.7,
  },
  venmoTitle: {
    fontWeight: 700,
    fontSize: 13,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: GREEN_DARK,
    margin: '0 0 8px',
  },
  venmoText: {
    fontSize: 14,
    lineHeight: 1.55,
    margin: '0 0 14px',
    color: GREEN_DARK,
  },
  venmoBtn: {
    display: 'inline-block',
    background: '#008CFF',
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    padding: '10px 22px',
    borderRadius: 8,
    textDecoration: 'none',
  },
  venmoBox: {
    background: GREEN_LIGHT,
    border: `1px solid #b3d9ca`,
    borderRadius: 10,
    padding: '14px 18px',
    fontSize: 14,
    color: GREEN_DARK,
    textAlign: 'left',
  },
  closedBox: {
    maxWidth: 440,
    margin: '40px 20px',
    padding: '32px 28px',
    background: '#fff',
    border: `1px solid #c8e0d5`,
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0, 103, 71, 0.12)',
    textAlign: 'center' as const,
  },
  closedHeading: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 24,
    fontWeight: 700,
    color: GREEN,
    margin: '0 0 14px',
  },
  closedText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 1.6,
    margin: 0,
  },
}

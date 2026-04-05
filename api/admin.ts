import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { password } = req.body ?? {}

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('entries')
    .select(`
      id,
      participant_name,
      email,
      submitted_at,
      paid,
      picks (
        tier,
        players ( name, slug )
      )
    `)
    .order('submitted_at', { ascending: true })

  if (error) {
    console.error('Admin query error:', error)
    return res.status(500).json({ error: 'Database error' })
  }

  const result = (data ?? []).map((entry: any) => ({
    id: entry.id,
    participant_name: entry.participant_name,
    email: entry.email,
    submitted_at: entry.submitted_at,
    paid: entry.paid,
    picks: (entry.picks ?? [])
      .map((pick: any) => ({
        tier: pick.tier,
        player_name: pick.players?.name ?? '(unknown)',
        slug: pick.players?.slug ?? '',
      }))
      .sort((a: any, b: any) => a.tier - b.tier),
  }))

  return res.status(200).json(result)
}

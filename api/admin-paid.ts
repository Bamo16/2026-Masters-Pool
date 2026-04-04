import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id, paid, password } = req.body ?? {}

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (id === undefined || typeof paid !== 'boolean') {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('entries')
    .update({ paid })
    .eq('id', id)

  if (error) {
    console.error('admin-paid error:', error)
    return res.status(500).json({ error: 'Database error' })
  }

  return res.status(200).json({ ok: true })
}

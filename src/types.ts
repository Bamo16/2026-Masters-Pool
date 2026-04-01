export interface Player {
  id: number
  world_rank: number | null
  name: string
  country: string | null
  tier: number
  player_id: string
}

export interface Entry {
  id: number
  participant_name: string
  email: string
  submitted_at: string
  paid: boolean
}

export interface Pick {
  id: number
  entry_id: number
  tier: number
  player_id: string
}

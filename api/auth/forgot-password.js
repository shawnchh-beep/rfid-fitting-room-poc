const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email } = req.body || {}

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const SUPABASE_URL = 'https://trgxtbqjkhydvbfndmhk.supabase.co'
    const SUPABASE_ANON_KEY = 'sb_publishable_RjeQR-HU84MRCpByTqZlxg_lwJHStMP'
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appBaseUrl}/auth-callback.html?next=/reset-password.html`
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}